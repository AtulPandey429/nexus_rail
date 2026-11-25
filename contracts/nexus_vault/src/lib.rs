#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env,
    String, Symbol,
};

#[cfg(test)]
mod test;

// Stellar ledger TTL constants (~5s per ledger)
// Instance: bump to ~30 days when below ~1 day
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = 17_280;
pub const INSTANCE_BUMP_AMOUNT: u32 = 518_400;
// Persistent (settled orders & replay keys): bump to ~60 days when below ~7 days
pub const PERSISTENT_LIFETIME_THRESHOLD: u32 = 120_960;
pub const PERSISTENT_BUMP_AMOUNT: u32 = 1_036_800;

pub const MAX_FEE_BPS: u32 = 500; // 5.00% hard safety cap
pub const BPS_DENOMINATOR: i128 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    NotInitialized = 1,
    Unauthorized = 2,
    ContractPaused = 3,
    FeeBpsTooHigh = 4,
    SplitPctInvalid = 5,
    InvalidAmount = 6,
    MathOverflow = 7,
    OrderAlreadySettled = 8,
    OrderNotFound = 9,
    OrderAlreadyRefunded = 10,
    RefundExceedsOrder = 11,
    ActionAlreadyProcessed = 12,
    SupplyCapExceeded = 13,
    NoPendingAdmin = 14,
    InvalidSupplyCap = 15,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    // Roles & governance
    Admin,
    PendingAdmin,
    Relayer,
    Pauser,
    // Vault routing & token config
    Treasury,
    NrReserve,
    NxlToken,
    OrderFeeBps,
    OwnerSplitPct,
    NxlSupplyCap,
    IsPaused,
    // Lifetime on-chain telemetry
    TotalOrdersSettled,
    TotalVolumeSettled,
    TotalOwnerFees,
    TotalReserveFees,
    TotalNxlMinted,
    TotalNxlBurned,
    TotalBridgeBurns,
    // Additive v2.1 storage keys (backward-compatible via .unwrap_or(0))
    TotalBuybackBurned,
    TotalRefunded,
    // Persistent replay-protected records — extended to ~60 days TTL per bump
    SettledOrder(BytesN<32>),
    ProcessedAction(BytesN<32>),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultConfig {
    pub admin: Address,
    pub pending_admin: Option<Address>,
    pub relayer: Address,
    pub pauser: Address,
    pub treasury: Address,
    pub nr_reserve: Address,
    pub nxl_token: Address,
    pub order_fee_bps: u32,
    pub owner_split_pct: u32,
    pub nxl_supply_cap: i128,
    pub is_paused: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultMetrics {
    pub total_orders_settled: u64,
    pub total_volume_settled: i128,
    pub total_owner_fees: i128,
    pub total_reserve_fees: i128,
    pub total_nxl_minted: i128,
    pub total_nxl_burned: i128,
    pub circulating_nxl: i128,
    pub remaining_mintable_nxl: i128,
    pub total_bridge_burns: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SettlementRecord {
    pub order_ref: BytesN<32>,
    pub payer: Address,
    pub token: Address,
    pub gross_amount: i128,
    pub principal: i128,
    pub owner_share: i128,
    pub nr_share: i128,
    pub settled_at: u64,
    pub refunded: bool,
    pub refund_amount: i128,
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

fn require_admin(env: &Env) -> Result<Address, VaultError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(VaultError::NotInitialized)?;
    admin.require_auth();
    Ok(admin)
}

fn require_admin_or_relayer(env: &Env, caller: &Address) -> Result<(), VaultError> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(VaultError::NotInitialized)?;
    let relayer: Address = env
        .storage()
        .instance()
        .get(&DataKey::Relayer)
        .ok_or(VaultError::NotInitialized)?;
    if *caller != admin && *caller != relayer {
        return Err(VaultError::Unauthorized);
    }
    caller.require_auth();
    Ok(())
}

fn require_not_paused(env: &Env) -> Result<(), VaultError> {
    let is_paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::IsPaused)
        .unwrap_or(false);
    if is_paused {
        return Err(VaultError::ContractPaused);
    }
    Ok(())
}

#[contract]
pub struct NexusVaultContract;

#[contractimpl]
impl NexusVaultContract {
    /// CAP-0058 Atomic Constructor
    /// Initializes RBAC roles, vaults, fee split, and $NXL supply cap in a single deploy transaction.
    #[allow(clippy::too_many_arguments)]
    pub fn __constructor(
        env: Env,
        admin: Address,
        relayer: Address,
        pauser: Address,
        treasury: Address,
        nr_reserve: Address,
        nxl_token: Address,
        order_fee_bps: u32,
        owner_split_pct: u32,
        nxl_supply_cap: i128,
        initial_circulating_nxl: i128,
    ) {
        if order_fee_bps > MAX_FEE_BPS {
            panic!("order_fee_bps exceeds MAX_FEE_BPS (500)");
        }
        if owner_split_pct > 100 {
            panic!("owner_split_pct must be 0..=100");
        }
        if nxl_supply_cap <= 0 || initial_circulating_nxl < 0 || initial_circulating_nxl > nxl_supply_cap {
            panic!("invalid supply cap or initial circulating supply");
        }

        let store = env.storage().instance();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Relayer, &relayer);
        store.set(&DataKey::Pauser, &pauser);
        store.set(&DataKey::Treasury, &treasury);
        store.set(&DataKey::NrReserve, &nr_reserve);
        store.set(&DataKey::NxlToken, &nxl_token);
        store.set(&DataKey::OrderFeeBps, &order_fee_bps);
        store.set(&DataKey::OwnerSplitPct, &owner_split_pct);
        store.set(&DataKey::NxlSupplyCap, &nxl_supply_cap);
        store.set(&DataKey::IsPaused, &false);

        store.set(&DataKey::TotalOrdersSettled, &0u64);
        store.set(&DataKey::TotalVolumeSettled, &0i128);
        store.set(&DataKey::TotalOwnerFees, &0i128);
        store.set(&DataKey::TotalReserveFees, &0i128);
        store.set(&DataKey::TotalNxlMinted, &initial_circulating_nxl);
        store.set(&DataKey::TotalNxlBurned, &0i128);
        store.set(&DataKey::TotalBridgeBurns, &0u64);

        bump_instance(&env);
    }

    // =========================================================================
    // 1. ATOMIC CHECKOUT SETTLEMENT & REFUND (50/50 REVENUE SPLIT + REPLAY LOCK)
    // =========================================================================

    /// Settles a Stellar checkout order atomically:
    /// - Splits protocol fee between Owner Treasury and $NXL Reserve Vault
    /// - Transfers principal + owner fee share to Treasury, reserve share to NrReserve
    /// - Locks `order_ref` permanently in persistent storage to prevent double-settlement
    pub fn settle_order(
        env: Env,
        payer: Address,
        token: Address,
        gross_amount: i128,
        order_ref: BytesN<32>,
    ) -> Result<SettlementRecord, VaultError> {
        require_not_paused(&env)?;
        if gross_amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        let order_key = DataKey::SettledOrder(order_ref.clone());
        if env.storage().persistent().has(&order_key) {
            return Err(VaultError::OrderAlreadySettled);
        }

        payer.require_auth();
        bump_instance(&env);

        let store = env.storage().instance();
        let treasury: Address = store.get(&DataKey::Treasury).ok_or(VaultError::NotInitialized)?;
        let nr_reserve: Address = store.get(&DataKey::NrReserve).ok_or(VaultError::NotInitialized)?;
        let fee_bps: u32 = store.get(&DataKey::OrderFeeBps).unwrap_or(100);
        let split_pct: u32 = store.get(&DataKey::OwnerSplitPct).unwrap_or(50);

        // Checked arithmetic for zero overflow risk
        let total_fee = gross_amount
            .checked_mul(fee_bps as i128)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(VaultError::MathOverflow)?;
        let owner_share = total_fee
            .checked_mul(split_pct as i128)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(100)
            .ok_or(VaultError::MathOverflow)?;
        let nr_share = total_fee
            .checked_sub(owner_share)
            .ok_or(VaultError::MathOverflow)?;
        let principal = gross_amount
            .checked_sub(total_fee)
            .ok_or(VaultError::MathOverflow)?;
        let treasury_payout = principal
            .checked_add(owner_share)
            .ok_or(VaultError::MathOverflow)?;

        // Execute atomic on-chain transfers via Soroban token client
        let client = token::Client::new(&env, &token);
        if treasury_payout > 0 {
            client.transfer(&payer, &treasury, &treasury_payout);
        }
        if nr_share > 0 {
            client.transfer(&payer, &nr_reserve, &nr_share);
        }

        let record = SettlementRecord {
            order_ref: order_ref.clone(),
            payer: payer.clone(),
            token: token.clone(),
            gross_amount,
            principal,
            owner_share,
            nr_share,
            settled_at: env.ledger().timestamp(),
            refunded: false,
            refund_amount: 0,
        };

        env.storage().persistent().set(&order_key, &record);
        bump_persistent(&env, &order_key);

        // Update lifetime metrics
        let total_orders: u64 = store.get(&DataKey::TotalOrdersSettled).unwrap_or(0);
        let total_volume: i128 = store.get(&DataKey::TotalVolumeSettled).unwrap_or(0);
        let total_owner: i128 = store.get(&DataKey::TotalOwnerFees).unwrap_or(0);
        let total_reserve: i128 = store.get(&DataKey::TotalReserveFees).unwrap_or(0);

        store.set(
            &DataKey::TotalOrdersSettled,
            &total_orders.checked_add(1).ok_or(VaultError::MathOverflow)?,
        );
        store.set(
            &DataKey::TotalVolumeSettled,
            &total_volume
                .checked_add(gross_amount)
                .ok_or(VaultError::MathOverflow)?,
        );
        store.set(
            &DataKey::TotalOwnerFees,
            &total_owner
                .checked_add(owner_share)
                .ok_or(VaultError::MathOverflow)?,
        );
        store.set(
            &DataKey::TotalReserveFees,
            &total_reserve
                .checked_add(nr_share)
                .ok_or(VaultError::MathOverflow)?,
        );

        env.events().publish(
            (symbol_short!("settled"), order_ref),
            (payer, token, gross_amount, principal, owner_share, nr_share),
        );

        Ok(record)
    }

    /// Refunds a previously settled order back to the original payer (Admin or Relayer only).
    /// Prevents double-refunds and caps refund at the original settled amount.
    pub fn refund_order(
        env: Env,
        operator: Address,
        order_ref: BytesN<32>,
        refund_amount: i128,
    ) -> Result<SettlementRecord, VaultError> {
        require_not_paused(&env)?;
        require_admin_or_relayer(&env, &operator)?;
        bump_instance(&env);

        if refund_amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        let order_key = DataKey::SettledOrder(order_ref.clone());
        let mut record: SettlementRecord = env
            .storage()
            .persistent()
            .get(&order_key)
            .ok_or(VaultError::OrderNotFound)?;

        if record.refunded || record.refund_amount >= record.gross_amount {
            return Err(VaultError::OrderAlreadyRefunded);
        }
        let cumulative_refund = record
            .refund_amount
            .checked_add(refund_amount)
            .ok_or(VaultError::MathOverflow)?;
        if cumulative_refund > record.gross_amount {
            return Err(VaultError::RefundExceedsOrder);
        }

        let client = token::Client::new(&env, &record.token);
        client.transfer(&operator, &record.payer, &refund_amount);

        record.refund_amount = cumulative_refund;
        record.refunded = cumulative_refund == record.gross_amount;
        env.storage().persistent().set(&order_key, &record);
        bump_persistent(&env, &order_key);

        let store = env.storage().instance();
        let total_refunded: i128 = store.get(&DataKey::TotalRefunded).unwrap_or(0);
        store.set(
            &DataKey::TotalRefunded,
            &total_refunded
                .checked_add(refund_amount)
                .ok_or(VaultError::MathOverflow)?,
        );

        env.events().publish(
            (symbol_short!("refunded"), order_ref),
            (operator, record.payer.clone(), refund_amount),
        );

        Ok(record)
    }

    // =========================================================================
    // 2. $NXL SUPPLY-CAPPED MINT & DEFLATIONARY / CROSS-CHAIN BURN CONTROLLER
    // =========================================================================

    /// Mints $NXL via the Stellar Asset Contract (SAC) under strict on-chain supply cap & replay lock.
    /// Used for: 2% loyalty cashback, XRPL -> Stellar bridge-in mints, and authorized treasury liquidity.
    pub fn mint_nxl(
        env: Env,
        caller: Address,
        recipient: Address,
        amount: i128,
        reason: Symbol,
        ref_id: BytesN<32>,
    ) -> Result<i128, VaultError> {
        require_not_paused(&env)?;
        require_admin_or_relayer(&env, &caller)?;
        bump_instance(&env);

        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        let action_key = DataKey::ProcessedAction(ref_id.clone());
        if env.storage().persistent().has(&action_key) {
            return Err(VaultError::ActionAlreadyProcessed);
        }

        let store = env.storage().instance();
        let nxl_token: Address = store.get(&DataKey::NxlToken).ok_or(VaultError::NotInitialized)?;
        let supply_cap: i128 = store.get(&DataKey::NxlSupplyCap).ok_or(VaultError::NotInitialized)?;
        let total_minted: i128 = store.get(&DataKey::TotalNxlMinted).unwrap_or(0);
        let total_burned: i128 = store.get(&DataKey::TotalNxlBurned).unwrap_or(0);
        let total_buyback_burned: i128 = store.get(&DataKey::TotalBuybackBurned).unwrap_or(0);

        // Deflationary buyback burns permanently reduce the effective supply cap,
        // whereas cross-chain bridge burns restore bridge-in minting headroom.
        let effective_supply_cap = supply_cap
            .checked_sub(total_buyback_burned)
            .ok_or(VaultError::MathOverflow)?;

        let new_total_minted = total_minted
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;
        let new_circulating = new_total_minted
            .checked_sub(total_burned)
            .ok_or(VaultError::MathOverflow)?;

        if new_circulating > effective_supply_cap {
            return Err(VaultError::SupplyCapExceeded);
        }

        // Execute real on-chain SAC mint (NexusVault must be SAC admin)
        let sac_admin = token::StellarAssetClient::new(&env, &nxl_token);
        sac_admin.mint(&recipient, &amount);

        // Persist replay lock & updated supply telemetry
        env.storage().persistent().set(&action_key, &true);
        bump_persistent(&env, &action_key);
        store.set(&DataKey::TotalNxlMinted, &new_total_minted);

        env.events().publish(
            (symbol_short!("nxl_mint"), reason, ref_id),
            (recipient, amount, new_circulating),
        );

        Ok(new_circulating)
    }

    /// Burns $NXL permanently via the SAC (deflationary fee buyback-and-burn or holder burn).
    pub fn burn_nxl(
        env: Env,
        holder: Address,
        amount: i128,
        reason: Symbol,
        ref_id: BytesN<32>,
    ) -> Result<i128, VaultError> {
        require_not_paused(&env)?;
        holder.require_auth();
        bump_instance(&env);

        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        let action_key = DataKey::ProcessedAction(ref_id.clone());
        if env.storage().persistent().has(&action_key) {
            return Err(VaultError::ActionAlreadyProcessed);
        }

        let store = env.storage().instance();
        let nxl_token: Address = store.get(&DataKey::NxlToken).ok_or(VaultError::NotInitialized)?;
        let total_burned: i128 = store.get(&DataKey::TotalNxlBurned).unwrap_or(0);

        let new_total_burned = total_burned
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;

        // Execute real on-chain SAC burn from holder
        let client = token::Client::new(&env, &nxl_token);
        client.burn(&holder, &amount);

        env.storage().persistent().set(&action_key, &true);
        bump_persistent(&env, &action_key);
        store.set(&DataKey::TotalNxlBurned, &new_total_burned);

        if reason == symbol_short!("buyback") {
            let prev_buyback: i128 = store.get(&DataKey::TotalBuybackBurned).unwrap_or(0);
            store.set(
                &DataKey::TotalBuybackBurned,
                &prev_buyback
                    .checked_add(amount)
                    .ok_or(VaultError::MathOverflow)?,
            );
        }

        env.events().publish(
            (symbol_short!("nxl_burn"), reason, ref_id),
            (holder, amount, new_total_burned),
        );

        Ok(new_total_burned)
    }

    /// Burns $NXL on Stellar specifically to bridge 1:1 to XRPL.
    /// Emits immutable `bridge_out` proof with XRPL destination address for the dual-rail relayer.
    pub fn burn_for_bridge(
        env: Env,
        holder: Address,
        amount: i128,
        xrpl_destination: String,
        swap_ref: BytesN<32>,
    ) -> Result<i128, VaultError> {
        let new_total_burned = Self::burn_nxl(
            env.clone(),
            holder.clone(),
            amount,
            symbol_short!("bridge"),
            swap_ref.clone(),
        )?;

        let store = env.storage().instance();
        let bridge_burns: u64 = store.get(&DataKey::TotalBridgeBurns).unwrap_or(0);
        store.set(
            &DataKey::TotalBridgeBurns,
            &bridge_burns.checked_add(1).ok_or(VaultError::MathOverflow)?,
        );

        env.events().publish(
            (symbol_short!("brg_out"), swap_ref),
            (holder, amount, xrpl_destination),
        );

        Ok(new_total_burned)
    }

    // =========================================================================
    // 3. GOVERNANCE, 2-STEP ADMIN TRANSFER, RBAC, PAUSE & IN-PLACE UPGRADE
    // =========================================================================

    pub fn update_config(
        env: Env,
        new_treasury: Option<Address>,
        new_nr_reserve: Option<Address>,
        new_fee_bps: Option<u32>,
        new_owner_split_pct: Option<u32>,
        new_supply_cap: Option<i128>,
    ) -> Result<(), VaultError> {
        require_admin(&env)?;
        bump_instance(&env);

        let store = env.storage().instance();
        if let Some(treasury) = new_treasury {
            store.set(&DataKey::Treasury, &treasury);
        }
        if let Some(nr_reserve) = new_nr_reserve {
            store.set(&DataKey::NrReserve, &nr_reserve);
        }
        if let Some(fee_bps) = new_fee_bps {
            if fee_bps > MAX_FEE_BPS {
                return Err(VaultError::FeeBpsTooHigh);
            }
            store.set(&DataKey::OrderFeeBps, &fee_bps);
        }
        if let Some(split_pct) = new_owner_split_pct {
            if split_pct > 100 {
                return Err(VaultError::SplitPctInvalid);
            }
            store.set(&DataKey::OwnerSplitPct, &split_pct);
        }
        if let Some(cap) = new_supply_cap {
            let total_minted: i128 = store.get(&DataKey::TotalNxlMinted).unwrap_or(0);
            let total_burned: i128 = store.get(&DataKey::TotalNxlBurned).unwrap_or(0);
            let circulating = total_minted.saturating_sub(total_burned);
            if cap <= 0 || cap < circulating {
                return Err(VaultError::InvalidSupplyCap);
            }
            store.set(&DataKey::NxlSupplyCap, &cap);
        }

        env.events()
            .publish((symbol_short!("config"), symbol_short!("updated")), ());
        Ok(())
    }

    pub fn set_relayer(env: Env, new_relayer: Address) -> Result<(), VaultError> {
        require_admin(&env)?;
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Relayer, &new_relayer);
        env.events()
            .publish((symbol_short!("role"), symbol_short!("relayer")), new_relayer);
        Ok(())
    }

    pub fn set_pauser(env: Env, new_pauser: Address) -> Result<(), VaultError> {
        require_admin(&env)?;
        bump_instance(&env);
        env.storage().instance().set(&DataKey::Pauser, &new_pauser);
        env.events()
            .publish((symbol_short!("role"), symbol_short!("pauser")), new_pauser);
        Ok(())
    }

    pub fn set_paused(env: Env, caller: Address, paused: bool) -> Result<(), VaultError> {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).ok_or(VaultError::NotInitialized)?;
        let pauser: Address = store.get(&DataKey::Pauser).ok_or(VaultError::NotInitialized)?;
        if caller != admin && caller != pauser {
            return Err(VaultError::Unauthorized);
        }
        caller.require_auth();
        bump_instance(&env);

        store.set(&DataKey::IsPaused, &paused);
        env.events()
            .publish((symbol_short!("pause"), symbol_short!("toggled")), (caller, paused));
        Ok(())
    }

    /// Step 1 of 2-step Admin Transfer (prevents accidental bricking via typo)
    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), VaultError> {
        require_admin(&env)?;
        bump_instance(&env);
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        env.events().publish(
            (symbol_short!("admin"), symbol_short!("proposed")),
            new_admin,
        );
        Ok(())
    }

    /// Step 2 of 2-step Admin Transfer — must be signed by the proposed new admin
    pub fn accept_admin(env: Env) -> Result<Address, VaultError> {
        bump_instance(&env);
        let store = env.storage().instance();
        let pending: Address = store
            .get(&DataKey::PendingAdmin)
            .ok_or(VaultError::NoPendingAdmin)?;
        pending.require_auth();

        store.set(&DataKey::Admin, &pending);
        store.remove(&DataKey::PendingAdmin);
        env.events().publish(
            (symbol_short!("admin"), symbol_short!("accepted")),
            pending.clone(),
        );
        Ok(pending)
    }

    /// Emergency / Migration escape hatch: rotates the $NXL SAC admin to another address
    pub fn set_nxl_sac_admin(env: Env, new_sac_admin: Address) -> Result<(), VaultError> {
        require_admin(&env)?;
        bump_instance(&env);
        let nxl_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::NxlToken)
            .ok_or(VaultError::NotInitialized)?;
        let sac_admin = token::StellarAssetClient::new(&env, &nxl_token);
        sac_admin.set_admin(&new_sac_admin);
        env.events().publish(
            (symbol_short!("sac"), symbol_short!("admin")),
            new_sac_admin,
        );
        Ok(())
    }

    /// Native Soroban In-Place WASM Upgrade (retains Contract ID & all storage)
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), VaultError> {
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
    // 4. READ-ONLY TELEMETRY & VERIFICATION VIEWS
    // =========================================================================

    pub fn get_config(env: Env) -> Result<VaultConfig, VaultError> {
        let store = env.storage().instance();
        Ok(VaultConfig {
            admin: store.get(&DataKey::Admin).ok_or(VaultError::NotInitialized)?,
            pending_admin: store.get(&DataKey::PendingAdmin),
            relayer: store.get(&DataKey::Relayer).ok_or(VaultError::NotInitialized)?,
            pauser: store.get(&DataKey::Pauser).ok_or(VaultError::NotInitialized)?,
            treasury: store.get(&DataKey::Treasury).ok_or(VaultError::NotInitialized)?,
            nr_reserve: store.get(&DataKey::NrReserve).ok_or(VaultError::NotInitialized)?,
            nxl_token: store.get(&DataKey::NxlToken).ok_or(VaultError::NotInitialized)?,
            order_fee_bps: store.get(&DataKey::OrderFeeBps).unwrap_or(100),
            owner_split_pct: store.get(&DataKey::OwnerSplitPct).unwrap_or(50),
            nxl_supply_cap: store.get(&DataKey::NxlSupplyCap).unwrap_or(0),
            is_paused: store.get(&DataKey::IsPaused).unwrap_or(false),
        })
    }

    pub fn get_metrics(env: Env) -> Result<VaultMetrics, VaultError> {
        let store = env.storage().instance();
        let supply_cap: i128 = store.get(&DataKey::NxlSupplyCap).ok_or(VaultError::NotInitialized)?;
        let total_minted: i128 = store.get(&DataKey::TotalNxlMinted).unwrap_or(0);
        let total_burned: i128 = store.get(&DataKey::TotalNxlBurned).unwrap_or(0);
        let total_buyback_burned: i128 = store.get(&DataKey::TotalBuybackBurned).unwrap_or(0);
        let effective_cap = supply_cap.saturating_sub(total_buyback_burned);
        let circulating = total_minted.saturating_sub(total_burned);
        let remaining = effective_cap.saturating_sub(circulating);

        Ok(VaultMetrics {
            total_orders_settled: store.get(&DataKey::TotalOrdersSettled).unwrap_or(0),
            total_volume_settled: store.get(&DataKey::TotalVolumeSettled).unwrap_or(0),
            total_owner_fees: store.get(&DataKey::TotalOwnerFees).unwrap_or(0),
            total_reserve_fees: store.get(&DataKey::TotalReserveFees).unwrap_or(0),
            total_nxl_minted: total_minted,
            total_nxl_burned: total_burned,
            circulating_nxl: circulating,
            remaining_mintable_nxl: remaining,
            total_bridge_burns: store.get(&DataKey::TotalBridgeBurns).unwrap_or(0),
        })
    }

    pub fn get_order(env: Env, order_ref: BytesN<32>) -> Option<SettlementRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::SettledOrder(order_ref))
    }

    pub fn is_action_processed(env: Env, ref_id: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::ProcessedAction(ref_id))
    }
}
