#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env,
    String,
};

#[cfg(test)]
mod test;

// Stellar ledger TTL constants (~5s per ledger)
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = 17_280;
pub const INSTANCE_BUMP_AMOUNT: u32 = 518_400;
pub const PERSISTENT_LIFETIME_THRESHOLD: u32 = 120_960;
pub const PERSISTENT_BUMP_AMOUNT: u32 = 1_036_800;

pub const MAX_SWAP_FEE_BPS: u32 = 300; // 3.00% safety cap
pub const BPS_DENOMINATOR: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SwapError {
    NotInitialized = 1,
    Unauthorized = 2,
    ContractPaused = 3,
    FeeBpsTooHigh = 4,
    SplitPctInvalid = 5,
    InvalidAmount = 6,
    InvalidToken = 7,
    MathOverflow = 8,
    PoolEmpty = 9,
    InsufficientLiquidity = 10,
    SlippageExceeded = 11,
    DeadlineExpired = 12,
    InvariantViolation = 13,
    InsufficientShares = 14,
    EscrowAlreadyExists = 15,
    EscrowNotFound = 16,
    EscrowNotLocked = 17,
    EscrowNotExpired = 18,
    InvalidExpiry = 19,
    NoPendingAdmin = 20,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EscrowStatus {
    Locked = 1,
    Released = 2,
    Refunded = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    // Roles & config
    Admin,
    PendingAdmin,
    Relayer,
    Treasury,
    TokenA, // Native XLM SAC
    TokenB, // $NXL SAC
    SwapFeeBps,
    OwnerFeeSplitPct,
    IsPaused,
    // Explicit AMM reserves (isolated from bridge escrow balances!)
    ReserveA,
    ReserveB,
    TotalLpShares,
    // Telemetry
    TotalSwaps,
    TotalVolumeA,
    TotalVolumeB,
    TotalOwnerFeesA,
    TotalOwnerFeesB,
    TotalEscrowsLocked,
    TotalEscrowsReleased,
    // Persistent per-user LP & per-swap Escrow
    LpBalance(Address),
    BridgeEscrow(BytesN<32>),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolState {
    pub admin: Address,
    pub relayer: Address,
    pub treasury: Address,
    pub token_a: Address,
    pub token_b: Address,
    pub reserve_a: i128,
    pub reserve_b: i128,
    pub total_lp_shares: i128,
    pub swap_fee_bps: u32,
    pub owner_fee_split_pct: u32,
    pub is_paused: bool,
    pub total_swaps: u64,
    pub total_volume_a: i128,
    pub total_volume_b: i128,
    pub total_owner_fees_a: i128,
    pub total_owner_fees_b: i128,
    pub total_escrows_locked: u64,
    pub total_escrows_released: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SwapQuote {
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: i128,
    pub amount_out: i128,
    pub total_fee: i128,
    pub owner_fee: i128,
    pub pool_fee: i128,
    pub reserve_in_after: i128,
    pub reserve_out_after: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SwapReceipt {
    pub trader: Address,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: i128,
    pub amount_out: i128,
    pub owner_fee: i128,
    pub pool_fee: i128,
    pub executed_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeEscrow {
    pub swap_id: BytesN<32>,
    pub sender: Address,
    pub token: Address,
    pub amount: i128,
    pub xrpl_destination: String,
    pub xrpl_tx_hash: String,
    pub created_at: u64,
    pub expiry_timestamp: u64,
    pub status: EscrowStatus,
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_LIFETIME_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}

fn require_admin(env: &Env) -> Result<Address, SwapError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(SwapError::NotInitialized)?;
    admin.require_auth();
    Ok(admin)
}

fn require_admin_or_relayer(env: &Env, caller: &Address) -> Result<(), SwapError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(SwapError::NotInitialized)?;
    let relayer: Address = env
        .storage()
        .instance()
        .get(&DataKey::Relayer)
        .ok_or(SwapError::NotInitialized)?;
    if *caller != admin && *caller != relayer {
        return Err(SwapError::Unauthorized);
    }
    caller.require_auth();
    Ok(())
}

fn require_not_paused(env: &Env) -> Result<(), SwapError> {
    if env
        .storage()
        .instance()
        .get(&DataKey::IsPaused)
        .unwrap_or(false)
    {
        return Err(SwapError::ContractPaused);
    }
    Ok(())
}

/// Checked integer square root using Newton-Raphson (no floating point in Soroban WASM)
fn isqrt_i128(n: i128) -> i128 {
    if n <= 0 {
        return 0;
    }
    if n == 1 {
        return 1;
    }
    let mut x = n / 2;
    let mut y = (x + n / x) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

#[contract]
pub struct NexusSwapContract;

#[contractimpl]
impl NexusSwapContract {
    /// CAP-0058 Atomic Constructor
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: Env,
        admin: Address,
        relayer: Address,
        treasury: Address,
        token_a: Address,
        token_b: Address,
        swap_fee_bps: u32,
        owner_fee_split_pct: u32,
    ) {
        if token_a == token_b {
            panic!("token_a and token_b must be distinct");
        }
        if swap_fee_bps > MAX_SWAP_FEE_BPS {
            panic!("swap_fee_bps exceeds MAX_SWAP_FEE_BPS (300)");
        }
        if owner_fee_split_pct > 100 {
            panic!("owner_fee_split_pct must be 0..=100");
        }

        let store = env.storage().instance();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Relayer, &relayer);
        store.set(&DataKey::Treasury, &treasury);
        store.set(&DataKey::TokenA, &token_a);
        store.set(&DataKey::TokenB, &token_b);
        store.set(&DataKey::SwapFeeBps, &swap_fee_bps);
        store.set(&DataKey::OwnerFeeSplitPct, &owner_fee_split_pct);
        store.set(&DataKey::IsPaused, &false);

        store.set(&DataKey::ReserveA, &0i128);
        store.set(&DataKey::ReserveB, &0i128);
        store.set(&DataKey::TotalLpShares, &0i128);

        store.set(&DataKey::TotalSwaps, &0u64);
        store.set(&DataKey::TotalVolumeA, &0i128);
        store.set(&DataKey::TotalVolumeB, &0i128);
        store.set(&DataKey::TotalOwnerFeesA, &0i128);
        store.set(&DataKey::TotalOwnerFeesB, &0i128);
        store.set(&DataKey::TotalEscrowsLocked, &0u64);
        store.set(&DataKey::TotalEscrowsReleased, &0u64);

        bump_instance(&env);
    }

    // =========================================================================
    // 1. CONSTANT-PRODUCT AMM LIQUIDITY (XLM <-> $NXL)
    // =========================================================================

    pub fn add_liquidity(
        env: Env,
        provider: Address,
        amount_a: i128,
        amount_b: i128,
        min_shares: i128,
    ) -> Result<i128, SwapError> {
        require_not_paused(&env)?;
        if amount_a <= 0 || amount_b <= 0 || min_shares < 0 {
            return Err(SwapError::InvalidAmount);
        }
        provider.require_auth();
        bump_instance(&env);

        let store = env.storage().instance();
        let token_a: Address = store.get(&DataKey::TokenA).ok_or(SwapError::NotInitialized)?;
        let token_b: Address = store.get(&DataKey::TokenB).ok_or(SwapError::NotInitialized)?;
        let reserve_a: i128 = store.get(&DataKey::ReserveA).unwrap_or(0);
        let reserve_b: i128 = store.get(&DataKey::ReserveB).unwrap_or(0);
        let total_shares: i128 = store.get(&DataKey::TotalLpShares).unwrap_or(0);

        let minted_shares = if total_shares == 0 {
            let prod = amount_a
                .checked_mul(amount_b)
                .ok_or(SwapError::MathOverflow)?;
            isqrt_i128(prod)
        } else {
            let shares_a = amount_a
                .checked_mul(total_shares)
                .ok_or(SwapError::MathOverflow)?
                .checked_div(reserve_a)
                .ok_or(SwapError::MathOverflow)?;
            let shares_b = amount_b
                .checked_mul(total_shares)
                .ok_or(SwapError::MathOverflow)?
                .checked_div(reserve_b)
                .ok_or(SwapError::MathOverflow)?;
            if shares_a < shares_b {
                shares_a
            } else {
                shares_b
            }
        };

        if minted_shares <= 0 || minted_shares < min_shares {
            return Err(SwapError::SlippageExceeded);
        }

        let contract_addr = env.current_contract_address();
        token::Client::new(&env, &token_a).transfer(&provider, &contract_addr, &amount_a);
        token::Client::new(&env, &token_b).transfer(&provider, &contract_addr, &amount_b);

        store.set(
            &DataKey::ReserveA,
            &reserve_a.checked_add(amount_a).ok_or(SwapError::MathOverflow)?,
        );
        store.set(
            &DataKey::ReserveB,
            &reserve_b.checked_add(amount_b).ok_or(SwapError::MathOverflow)?,
        );
        store.set(
            &DataKey::TotalLpShares,
            &total_shares
                .checked_add(minted_shares)
                .ok_or(SwapError::MathOverflow)?,
        );

        let lp_key = DataKey::LpBalance(provider.clone());
        let prev_lp: i128 = env.storage().persistent().get(&lp_key).unwrap_or(0);
        env.storage().persistent().set(
            &lp_key,
            &prev_lp
                .checked_add(minted_shares)
                .ok_or(SwapError::MathOverflow)?,
        );
        bump_persistent(&env, &lp_key);

        env.events().publish(
            (symbol_short!("lp_add"), provider),
            (amount_a, amount_b, minted_shares),
        );

        Ok(minted_shares)
    }

    pub fn remove_liquidity(
        env: Env,
        provider: Address,
        shares: i128,
        min_amount_a: i128,
        min_amount_b: i128,
    ) -> Result<(i128, i128), SwapError> {
        require_not_paused(&env)?;
        if shares <= 0 || min_amount_a < 0 || min_amount_b < 0 {
            return Err(SwapError::InvalidAmount);
        }
        provider.require_auth();
        bump_instance(&env);

        let lp_key = DataKey::LpBalance(provider.clone());
        let user_shares: i128 = env.storage().persistent().get(&lp_key).unwrap_or(0);
        if user_shares < shares {
            return Err(SwapError::InsufficientShares);
        }

        let store = env.storage().instance();
        let token_a: Address = store.get(&DataKey::TokenA).ok_or(SwapError::NotInitialized)?;
        let token_b: Address = store.get(&DataKey::TokenB).ok_or(SwapError::NotInitialized)?;
        let reserve_a: i128 = store.get(&DataKey::ReserveA).unwrap_or(0);
        let reserve_b: i128 = store.get(&DataKey::ReserveB).unwrap_or(0);
        let total_shares: i128 = store.get(&DataKey::TotalLpShares).unwrap_or(0);
        if total_shares <= 0 {
            return Err(SwapError::PoolEmpty);
        }

        let amount_a = shares
            .checked_mul(reserve_a)
            .ok_or(SwapError::MathOverflow)?
            .checked_div(total_shares)
            .ok_or(SwapError::MathOverflow)?;
        let amount_b = shares
            .checked_mul(reserve_b)
            .ok_or(SwapError::MathOverflow)?
            .checked_div(total_shares)
            .ok_or(SwapError::MathOverflow)?;

        if amount_a < min_amount_a || amount_b < min_amount_b {
            return Err(SwapError::SlippageExceeded);
        }

        store.set(
            &DataKey::ReserveA,
            &reserve_a.checked_sub(amount_a).ok_or(SwapError::MathOverflow)?,
        );
        store.set(
            &DataKey::ReserveB,
            &reserve_b.checked_sub(amount_b).ok_or(SwapError::MathOverflow)?,
        );
        store.set(
            &DataKey::TotalLpShares,
            &total_shares
                .checked_sub(shares)
                .ok_or(SwapError::MathOverflow)?,
        );

        let remaining = user_shares
            .checked_sub(shares)
            .ok_or(SwapError::MathOverflow)?;
        env.storage().persistent().set(&lp_key, &remaining);
        bump_persistent(&env, &lp_key);

        let contract_addr = env.current_contract_address();
        if amount_a > 0 {
            token::Client::new(&env, &token_a).transfer(&contract_addr, &provider, &amount_a);
        }
        if amount_b > 0 {
            token::Client::new(&env, &token_b).transfer(&contract_addr, &provider, &amount_b);
        }

        env.events().publish(
            (symbol_short!("lp_rem"), provider),
            (shares, amount_a, amount_b),
        );

        Ok((amount_a, amount_b))
    }

    // =========================================================================
    // 2. ON-CHAIN CONSTANT-PRODUCT AMM SWAP (x * y = k + SLIPPAGE + 50/50 FEE)
    // =========================================================================

    pub fn quote_swap(
        env: Env,
        token_in: Address,
        amount_in: i128,
    ) -> Result<SwapQuote, SwapError> {
        if amount_in <= 0 {
            return Err(SwapError::InvalidAmount);
        }

        let store = env.storage().instance();
        let token_a: Address = store.get(&DataKey::TokenA).ok_or(SwapError::NotInitialized)?;
        let token_b: Address = store.get(&DataKey::TokenB).ok_or(SwapError::NotInitialized)?;
        let reserve_a: i128 = store.get(&DataKey::ReserveA).unwrap_or(0);
        let reserve_b: i128 = store.get(&DataKey::ReserveB).unwrap_or(0);
        if reserve_a <= 0 || reserve_b <= 0 {
            return Err(SwapError::PoolEmpty);
        }

        let (token_out, reserve_in, reserve_out) = if token_in == token_a {
            (token_b, reserve_a, reserve_b)
        } else if token_in == token_b {
            (token_a, reserve_b, reserve_a)
        } else {
            return Err(SwapError::InvalidToken);
        };

        let fee_bps: u32 = store.get(&DataKey::SwapFeeBps).unwrap_or(50);
        let owner_split_pct: u32 = store.get(&DataKey::OwnerFeeSplitPct).unwrap_or(50);

        let total_fee = amount_in
            .checked_mul(fee_bps as i128)
            .ok_or(SwapError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(SwapError::MathOverflow)?;
        let owner_fee = total_fee
            .checked_mul(owner_split_pct as i128)
            .ok_or(SwapError::MathOverflow)?
            .checked_div(100)
            .ok_or(SwapError::MathOverflow)?;
        let pool_fee = total_fee
            .checked_sub(owner_fee)
            .ok_or(SwapError::MathOverflow)?;
        let amount_in_effective = amount_in
            .checked_sub(total_fee)
            .ok_or(SwapError::MathOverflow)?;
        if amount_in_effective <= 0 {
            return Err(SwapError::InvalidAmount);
        }

        // Constant-product formula: dy = (dx_eff * y) / (x + dx_eff)
        let numerator = amount_in_effective
            .checked_mul(reserve_out)
            .ok_or(SwapError::MathOverflow)?;
        let denominator = reserve_in
            .checked_add(amount_in_effective)
            .ok_or(SwapError::MathOverflow)?;
        let amount_out = numerator
            .checked_div(denominator)
            .ok_or(SwapError::MathOverflow)?;

        if amount_out <= 0 || amount_out >= reserve_out {
            return Err(SwapError::InsufficientLiquidity);
        }

        // Pool keeps (amount_in_effective + pool_fee) = (amount_in - owner_fee)
        let net_in_to_pool = amount_in
            .checked_sub(owner_fee)
            .ok_or(SwapError::MathOverflow)?;
        let reserve_in_after = reserve_in
            .checked_add(net_in_to_pool)
            .ok_or(SwapError::MathOverflow)?;
        let reserve_out_after = reserve_out
            .checked_sub(amount_out)
            .ok_or(SwapError::MathOverflow)?;

        Ok(SwapQuote {
            token_in,
            token_out,
            amount_in,
            amount_out,
            total_fee,
            owner_fee,
            pool_fee,
            reserve_in_after,
            reserve_out_after,
        })
    }

    pub fn swap_exact_in(
        env: Env,
        trader: Address,
        token_in: Address,
        amount_in: i128,
        min_amount_out: i128,
        deadline: u64,
    ) -> Result<SwapReceipt, SwapError> {
        require_not_paused(&env)?;
        if env.ledger().timestamp() > deadline {
            return Err(SwapError::DeadlineExpired);
        }
        if min_amount_out < 0 {
            return Err(SwapError::InvalidAmount);
        }
        trader.require_auth();
        bump_instance(&env);

        let quote = Self::quote_swap(env.clone(), token_in.clone(), amount_in)?;
        if quote.amount_out < min_amount_out {
            return Err(SwapError::SlippageExceeded);
        }

        let store = env.storage().instance();
        let token_a: Address = store.get(&DataKey::TokenA).ok_or(SwapError::NotInitialized)?;
        let treasury: Address = store.get(&DataKey::Treasury).ok_or(SwapError::NotInitialized)?;
        let reserve_a: i128 = store.get(&DataKey::ReserveA).unwrap_or(0);
        let reserve_b: i128 = store.get(&DataKey::ReserveB).unwrap_or(0);

        // Verify constant-product invariant k_after >= k_before
        let k_before = reserve_a
            .checked_mul(reserve_b)
            .ok_or(SwapError::MathOverflow)?;
        let k_after = quote
            .reserve_in_after
            .checked_mul(quote.reserve_out_after)
            .ok_or(SwapError::MathOverflow)?;
        if k_after < k_before {
            return Err(SwapError::InvariantViolation);
        }

        // Execute token transfers
        let contract_addr = env.current_contract_address();
        let in_client = token::Client::new(&env, &quote.token_in);
        let out_client = token::Client::new(&env, &quote.token_out);

        in_client.transfer(&trader, &contract_addr, &amount_in);
        if quote.owner_fee > 0 {
            in_client.transfer(&contract_addr, &treasury, &quote.owner_fee);
        }
        out_client.transfer(&contract_addr, &trader, &quote.amount_out);

        // Update reserves & lifetime metrics
        if token_in == token_a {
            store.set(&DataKey::ReserveA, &quote.reserve_in_after);
            store.set(&DataKey::ReserveB, &quote.reserve_out_after);
            let vol_a: i128 = store.get(&DataKey::TotalVolumeA).unwrap_or(0);
            let fees_a: i128 = store.get(&DataKey::TotalOwnerFeesA).unwrap_or(0);
            store.set(
                &DataKey::TotalVolumeA,
                &vol_a.checked_add(amount_in).ok_or(SwapError::MathOverflow)?,
            );
            store.set(
                &DataKey::TotalOwnerFeesA,
                &fees_a
                    .checked_add(quote.owner_fee)
                    .ok_or(SwapError::MathOverflow)?,
            );
        } else {
            store.set(&DataKey::ReserveB, &quote.reserve_in_after);
            store.set(&DataKey::ReserveA, &quote.reserve_out_after);
            let vol_b: i128 = store.get(&DataKey::TotalVolumeB).unwrap_or(0);
            let fees_b: i128 = store.get(&DataKey::TotalOwnerFeesB).unwrap_or(0);
            store.set(
                &DataKey::TotalVolumeB,
                &vol_b.checked_add(amount_in).ok_or(SwapError::MathOverflow)?,
            );
            store.set(
                &DataKey::TotalOwnerFeesB,
                &fees_b
                    .checked_add(quote.owner_fee)
                    .ok_or(SwapError::MathOverflow)?,
            );
        }

        let swaps: u64 = store.get(&DataKey::TotalSwaps).unwrap_or(0);
        store.set(
            &DataKey::TotalSwaps,
            &swaps.checked_add(1).ok_or(SwapError::MathOverflow)?,
        );

        let receipt = SwapReceipt {
            trader: trader.clone(),
            token_in: quote.token_in.clone(),
            token_out: quote.token_out.clone(),
            amount_in,
            amount_out: quote.amount_out,
            owner_fee: quote.owner_fee,
            pool_fee: quote.pool_fee,
            executed_at: env.ledger().timestamp(),
        };

        env.events().publish(
            (symbol_short!("swap"), trader),
            (
                quote.token_in,
                quote.token_out,
                amount_in,
                quote.amount_out,
                quote.owner_fee,
                quote.pool_fee,
            ),
        );

        Ok(receipt)
    }

    // =========================================================================
    // 3. TRUSTLESS CROSS-CHAIN BRIDGE ESCROW (STELLAR <-> XRPL)
    // =========================================================================

    /// Locks user's Stellar deposit (XLM or $NXL) in on-chain escrow for a cross-chain swap to XRPL.
    /// Funds remain strictly isolated from AMM reserves and are refundable after `expiry_timestamp`.
    pub fn lock_bridge_escrow(
        env: Env,
        sender: Address,
        token: Address,
        amount: i128,
        swap_id: BytesN<32>,
        xrpl_destination: String,
        expiry_timestamp: u64,
    ) -> Result<BridgeEscrow, SwapError> {
        require_not_paused(&env)?;
        if amount <= 0 {
            return Err(SwapError::InvalidAmount);
        }
        let now = env.ledger().timestamp();
        if expiry_timestamp <= now {
            return Err(SwapError::InvalidExpiry);
        }
        sender.require_auth();
        bump_instance(&env);

        let key = DataKey::BridgeEscrow(swap_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(SwapError::EscrowAlreadyExists);
        }

        let store = env.storage().instance();
        let token_a: Address = store.get(&DataKey::TokenA).ok_or(SwapError::NotInitialized)?;
        let token_b: Address = store.get(&DataKey::TokenB).ok_or(SwapError::NotInitialized)?;
        if token != token_a && token != token_b {
            return Err(SwapError::InvalidToken);
        }

        let contract_addr = env.current_contract_address();
        token::Client::new(&env, &token).transfer(&sender, &contract_addr, &amount);

        let escrow = BridgeEscrow {
            swap_id: swap_id.clone(),
            sender: sender.clone(),
            token: token.clone(),
            amount,
            xrpl_destination: xrpl_destination.clone(),
            xrpl_tx_hash: String::from_str(&env, ""),
            created_at: now,
            expiry_timestamp,
            status: EscrowStatus::Locked,
        };

        env.storage().persistent().set(&key, &escrow);
        bump_persistent(&env, &key);

        let locked: u64 = store.get(&DataKey::TotalEscrowsLocked).unwrap_or(0);
        store.set(
            &DataKey::TotalEscrowsLocked,
            &locked.checked_add(1).ok_or(SwapError::MathOverflow)?,
        );

        env.events().publish(
            (symbol_short!("esc_lock"), swap_id),
            (sender, token, amount, xrpl_destination, expiry_timestamp),
        );

        Ok(escrow)
    }

    /// Releases a locked bridge escrow to platform liquidity vault after XRPL payout is settled.
    /// Stores the immutable `xrpl_tx_hash` proof on-chain.
    pub fn release_bridge_escrow(
        env: Env,
        caller: Address,
        swap_id: BytesN<32>,
        recipient: Address,
        xrpl_tx_hash: String,
    ) -> Result<BridgeEscrow, SwapError> {
        require_not_paused(&env)?;
        require_admin_or_relayer(&env, &caller)?;
        bump_instance(&env);

        let key = DataKey::BridgeEscrow(swap_id.clone());
        let mut escrow: BridgeEscrow = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(SwapError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Locked {
            return Err(SwapError::EscrowNotLocked);
        }

        escrow.status = EscrowStatus::Released;
        escrow.xrpl_tx_hash = xrpl_tx_hash.clone();
        env.storage().persistent().set(&key, &escrow);
        bump_persistent(&env, &key);

        let contract_addr = env.current_contract_address();
        token::Client::new(&env, &escrow.token).transfer(&contract_addr, &recipient, &escrow.amount);

        let store = env.storage().instance();
        let released: u64 = store.get(&DataKey::TotalEscrowsReleased).unwrap_or(0);
        store.set(
            &DataKey::TotalEscrowsReleased,
            &released.checked_add(1).ok_or(SwapError::MathOverflow)?,
        );

        env.events().publish(
            (symbol_short!("esc_rel"), swap_id),
            (recipient, escrow.amount, xrpl_tx_hash),
        );

        Ok(escrow)
    }

    /// Refunds a locked bridge escrow back to the original `sender`:
    /// - After `expiry_timestamp`: permissionless (user can self-recover without admin!)
    /// - Before `expiry_timestamp`: Admin or Relayer can abort & return funds immediately
    pub fn refund_expired_escrow(
        env: Env,
        caller: Address,
        swap_id: BytesN<32>,
    ) -> Result<BridgeEscrow, SwapError> {
        bump_instance(&env);

        let key = DataKey::BridgeEscrow(swap_id.clone());
        let mut escrow: BridgeEscrow = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(SwapError::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Locked {
            return Err(SwapError::EscrowNotLocked);
        }

        let now = env.ledger().timestamp();
        if now < escrow.expiry_timestamp {
            // Early abort allowed only by Admin or Relayer
            require_admin_or_relayer(&env, &caller)?;
        } else {
            // Expired: sender or any caller can trigger self-recovery back to original sender
            caller.require_auth();
        }

        escrow.status = EscrowStatus::Refunded;
        env.storage().persistent().set(&key, &escrow);
        bump_persistent(&env, &key);

        let contract_addr = env.current_contract_address();
        token::Client::new(&env, &escrow.token).transfer(
            &contract_addr,
            &escrow.sender,
            &escrow.amount,
        );

        env.events().publish(
            (symbol_short!("esc_ref"), swap_id),
            (escrow.sender.clone(), escrow.amount),
        );

        Ok(escrow)
    }

    // =========================================================================
    // 4. GOVERNANCE, PAUSE, 2-STEP ADMIN & UPGRADE
    // =========================================================================

    pub fn update_config(
        env: Env,
        new_treasury: Option<Address>,
        new_swap_fee_bps: Option<u32>,
        new_owner_split_pct: Option<u32>,
    ) -> Result<(), SwapError> {
        require_admin(&env)?;
        bump_instance(&env);
        let store = env.storage().instance();

        if let Some(treasury) = new_treasury {
            store.set(&DataKey::Treasury, &treasury);
        }
        if let Some(fee_bps) = new_swap_fee_bps {
            if fee_bps > MAX_SWAP_FEE_BPS {
                return Err(SwapError::FeeBpsTooHigh);
            }
            store.set(&DataKey::SwapFeeBps, &fee_bps);
        }
        if let Some(split_pct) = new_owner_split_pct {
            if split_pct > 100 {
                return Err(SwapError::SplitPctInvalid);
            }
            store.set(&DataKey::OwnerFeeSplitPct, &split_pct);
        }

        env.events()
            .publish((symbol_short!("config"), symbol_short!("updated")), ());
        Ok(())
    }

    pub fn set_relayer(env: Env, new_relayer: Address) -> Result<(), SwapError> {
        require_admin(&env)?;
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Relayer, &new_relayer);
        Ok(())
    }

    pub fn set_paused(env: Env, paused: bool) -> Result<(), SwapError> {
        require_admin(&env)?;
        bump_instance(&env);
        env.storage().instance().set(&DataKey::IsPaused, &paused);
        env.events()
            .publish((symbol_short!("pause"), symbol_short!("toggled")), paused);
        Ok(())
    }

    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), SwapError> {
        require_admin(&env)?;
        bump_instance(&env);
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        Ok(())
    }

    pub fn accept_admin(env: Env) -> Result<Address, SwapError> {
        bump_instance(&env);
        let store = env.storage().instance();
        let pending: Address = store
            .get(&DataKey::PendingAdmin)
            .ok_or(SwapError::NoPendingAdmin)?;
        pending.require_auth();
        store.set(&DataKey::Admin, &pending);
        store.remove(&DataKey::PendingAdmin);
        Ok(pending)
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), SwapError> {
        require_admin(&env)?;
        bump_instance(&env);
        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());
        env.events().publish(
            (symbol_short!("contract"), symbol_short!("upgraded")),
            new_wasm_hash,
        );
        Ok(())
    }

    // =========================================================================
    // 5. READ-ONLY VIEWS
    // =========================================================================

    pub fn get_pool_state(env: Env) -> Result<PoolState, SwapError> {
        let store = env.storage().instance();
        Ok(PoolState {
            admin: store.get(&DataKey::Admin).ok_or(SwapError::NotInitialized)?,
            relayer: store.get(&DataKey::Relayer).ok_or(SwapError::NotInitialized)?,
            treasury: store.get(&DataKey::Treasury).ok_or(SwapError::NotInitialized)?,
            token_a: store.get(&DataKey::TokenA).ok_or(SwapError::NotInitialized)?,
            token_b: store.get(&DataKey::TokenB).ok_or(SwapError::NotInitialized)?,
            reserve_a: store.get(&DataKey::ReserveA).unwrap_or(0),
            reserve_b: store.get(&DataKey::ReserveB).unwrap_or(0),
            total_lp_shares: store.get(&DataKey::TotalLpShares).unwrap_or(0),
            swap_fee_bps: store.get(&DataKey::SwapFeeBps).unwrap_or(50),
            owner_fee_split_pct: store.get(&DataKey::OwnerFeeSplitPct).unwrap_or(50),
            is_paused: store.get(&DataKey::IsPaused).unwrap_or(false),
            total_swaps: store.get(&DataKey::TotalSwaps).unwrap_or(0),
            total_volume_a: store.get(&DataKey::TotalVolumeA).unwrap_or(0),
            total_volume_b: store.get(&DataKey::TotalVolumeB).unwrap_or(0),
            total_owner_fees_a: store.get(&DataKey::TotalOwnerFeesA).unwrap_or(0),
            total_owner_fees_b: store.get(&DataKey::TotalOwnerFeesB).unwrap_or(0),
            total_escrows_locked: store.get(&DataKey::TotalEscrowsLocked).unwrap_or(0),
            total_escrows_released: store.get(&DataKey::TotalEscrowsReleased).unwrap_or(0),
        })
    }

    pub fn get_lp_balance(env: Env, provider: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::LpBalance(provider))
            .unwrap_or(0)
    }

    pub fn get_escrow(env: Env, swap_id: BytesN<32>) -> Option<BridgeEscrow> {
        env.storage()
            .persistent()
            .get(&DataKey::BridgeEscrow(swap_id))
    }
}
