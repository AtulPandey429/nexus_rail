#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short,
    Address, BytesN, Env, IntoVal, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum VaultError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    ContractPaused = 3,
    FeeBpsTooHigh = 4,
    SplitPctInvalid = 5,
    InvalidAmount = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Treasury,
    NrReserve,
    OrderFeeBps,
    OwnerSplitPct,
    IsPaused,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultConfig {
    pub admin: Address,
    pub treasury: Address,
    pub nr_reserve: Address,
    pub order_fee_bps: u32,
    pub owner_split_pct: u32,
    pub is_paused: bool,
}

pub const MAX_FEE_BPS: u32 = 500; // 5.00% safety cap

#[contract]
pub struct NexusVaultContract;

#[contractimpl]
impl NexusVaultContract {
    /// CAP-0058 Protocol 22 Atomic Constructor
    /// Initializes ownership and fee parameters atomically at contract deployment.
    pub fn __constructor(
        env: Env,
        admin: Address,
        treasury: Address,
        nr_reserve: Address,
        order_fee_bps: u32,
        owner_split_pct: u32,
    ) {
        if order_fee_bps > MAX_FEE_BPS {
            panic!("Fee exceeds max allowable threshold");
        }
        if owner_split_pct > 100 {
            panic!("Owner split percentage cannot exceed 100");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::NrReserve, &nr_reserve);
        env.storage().instance().set(&DataKey::OrderFeeBps, &order_fee_bps);
        env.storage().instance().set(&DataKey::OwnerSplitPct, &owner_split_pct);
        env.storage().instance().set(&DataKey::IsPaused, &false);
    }

    /// Dynamic Configuration Update (Zero-Redeployment Admin Control)
    /// Allows the platform owner to tune fee BPS, revenue split %, or payout vaults live.
    pub fn update_config(
        env: Env,
        new_treasury: Option<Address>,
        new_nr_reserve: Option<Address>,
        new_fee_bps: Option<u32>,
        new_owner_split_pct: Option<u32>,
    ) -> Result<(), VaultError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(VaultError::NotInitialized)?;
        admin.require_auth();

        if let Some(treasury) = new_treasury {
            env.storage().instance().set(&DataKey::Treasury, &treasury);
        }
        if let Some(nr_reserve) = new_nr_reserve {
            env.storage().instance().set(&DataKey::NrReserve, &nr_reserve);
        }
        if let Some(fee_bps) = new_fee_bps {
            if fee_bps > MAX_FEE_BPS {
                return Err(VaultError::FeeBpsTooHigh);
            }
            env.storage().instance().set(&DataKey::OrderFeeBps, &fee_bps);
        }
        if let Some(split_pct) = new_owner_split_pct {
            if split_pct > 100 {
                return Err(VaultError::SplitPctInvalid);
            }
            env.storage().instance().set(&DataKey::OwnerSplitPct, &split_pct);
        }

        env.events().publish((symbol_short!("config"), symbol_short!("updated")), ());
        Ok(())
    }

    /// Stellar Native In-Place Code Upgrade
    /// Upgrades the contract's executing WASM code directly under the SAME Contract ID.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), VaultError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(VaultError::NotInitialized)?;
        admin.require_auth();

        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());
        env.events().publish((symbol_short!("contract"), symbol_short!("upgraded")), new_wasm_hash);
        Ok(())
    }

    /// Atomic Settlement with 50/50 Revenue Split
    /// Transfers net principal and splits protocol fee between Treasury and $NR Reserve.
    pub fn settle_with_split(
        env: Env,
        payer: Address,
        token: Address,
        gross_amount: i128,
        order_ref: Symbol,
    ) -> Result<(i128, i128, i128), VaultError> {
        let is_paused: bool = env.storage().instance().get(&DataKey::IsPaused).unwrap_or(false);
        if is_paused {
            return Err(VaultError::ContractPaused);
        }
        if gross_amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        payer.require_auth();

        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).ok_or(VaultError::NotInitialized)?;
        let nr_reserve: Address = env.storage().instance().get(&DataKey::NrReserve).ok_or(VaultError::NotInitialized)?;
        let fee_bps: u32 = env.storage().instance().get(&DataKey::OrderFeeBps).unwrap_or(100);
        let split_pct: u32 = env.storage().instance().get(&DataKey::OwnerSplitPct).unwrap_or(50);

        // 1. Compute fee and split amounts
        let total_fee = (gross_amount * fee_bps as i128) / 10_000;
        let owner_share = (total_fee * split_pct as i128) / 100;
        let nr_share = total_fee - owner_share;
        let principal = gross_amount - total_fee;

        // 2. Execute on-chain token transfers via Soroban Token Client
        let client = soroban_sdk::token::Client::new(&env, &token);

        // Transfer principal + owner fee share directly to Treasury
        if principal + owner_share > 0 {
            client.transfer(&payer, &treasury, &(principal + owner_share));
        }

        // Transfer $NR buyback liquidity share to $NR Reserve Vault
        if nr_share > 0 {
            client.transfer(&payer, &nr_reserve, &nr_share);
        }

        // 3. Emit immutable on-chain audit event
        env.events().publish(
            (symbol_short!("settled"), order_ref),
            (gross_amount, principal, owner_share, nr_share),
        );

        Ok((principal, owner_share, nr_share))
    }

    /// Emergency Pause Switch
    pub fn set_paused(env: Env, paused: bool) -> Result<(), VaultError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(VaultError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::IsPaused, &paused);
        env.events().publish((symbol_short!("pause"), symbol_short!("toggled")), paused);
        Ok(())
    }

    /// Query Contract Configuration
    pub fn get_config(env: Env) -> Result<VaultConfig, VaultError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(VaultError::NotInitialized)?;
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).ok_or(VaultError::NotInitialized)?;
        let nr_reserve: Address = env.storage().instance().get(&DataKey::NrReserve).ok_or(VaultError::NotInitialized)?;
        let order_fee_bps: u32 = env.storage().instance().get(&DataKey::OrderFeeBps).unwrap_or(100);
        let owner_split_pct: u32 = env.storage().instance().get(&DataKey::OwnerSplitPct).unwrap_or(50);
        let is_paused: bool = env.storage().instance().get(&DataKey::IsPaused).unwrap_or(false);

        Ok(VaultConfig {
            admin,
            treasury,
            nr_reserve,
            order_fee_bps,
            owner_split_pct,
            is_paused,
        })
    }
}
