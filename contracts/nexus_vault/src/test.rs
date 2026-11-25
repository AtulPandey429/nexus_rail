#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, String,
};

struct VaultFixture<'a> {
    env: Env,
    admin: Address,
    relayer: Address,
    pauser: Address,
    treasury: Address,
    nr_reserve: Address,
    payer: Address,
    xlm_id: Address,
    nxl_id: Address,
    client: NexusVaultContractClient<'a>,
}

fn setup_vault<'a>() -> VaultFixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let relayer = Address::generate(&env);
    let pauser = Address::generate(&env);
    let treasury = Address::generate(&env);
    let nr_reserve = Address::generate(&env);
    let payer = Address::generate(&env);

    // Register test Stellar Asset Contracts (XLM + NXL)
    let xlm_admin = Address::generate(&env);
    let xlm_sac = env.register_stellar_asset_contract_v2(xlm_admin);
    let xlm_id = xlm_sac.address();

    let nxl_init_admin = Address::generate(&env);
    let nxl_sac = env.register_stellar_asset_contract_v2(nxl_init_admin);
    let nxl_id = nxl_sac.address();

    // Fund payer with 10,000 XLM (7 decimals = 100_000_000_000 stroops)
    StellarAssetClient::new(&env, &xlm_id).mint(&payer, &100_000_000_000);

    // 1,000,000 NXL hard cap (7 decimals), 100,000 NXL genesis circulating
    let supply_cap: i128 = 10_000_000_000_000;
    let initial_circulating: i128 = 1_000_000_000_000;

    let vault_id = env.register(
        NexusVaultContract,
        (
            admin.clone(),
            relayer.clone(),
            pauser.clone(),
            treasury.clone(),
            nr_reserve.clone(),
            nxl_id.clone(),
            100u32, // 1.00% order fee
            50u32,  // 50/50 split
            supply_cap,
            initial_circulating,
        ),
    );

    // Hand $NXL SAC admin rights to NexusVault so it can mint under supply cap
    StellarAssetClient::new(&env, &nxl_id).set_admin(&vault_id);

    // Note: leaks Env reference? No, create client directly from env in tests using helper
    // Keep client created from cloned Env handle (soroban_sdk::Env is Rc-backed!)
    let env_clone = env.clone();
    let client = NexusVaultContractClient::new(&env_clone, &vault_id);

    VaultFixture {
        env,
        admin,
        relayer,
        pauser,
        treasury,
        nr_reserve,
        payer,
        xlm_id,
        nxl_id,
        client,
    }
}

fn ref_bytes(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

#[test]
fn test_atomic_settlement_and_50_50_split() {
    let f = setup_vault();
    let order_ref = ref_bytes(&f.env, 1);

    // Gross = 1,000 XLM (10_000_000_000 stroops)
    // Fee 1% = 10 XLM -> 5 XLM owner_share + 5 XLM nr_share
    // Principal = 990 XLM -> Treasury gets 995 XLM, NrReserve gets 5 XLM
    let gross: i128 = 10_000_000_000;
    let receipt = f
        .client
        .settle_order(&f.payer, &f.xlm_id, &gross, &order_ref);

    assert_eq!(receipt.principal, 9_900_000_000);
    assert_eq!(receipt.owner_share, 50_000_000);
    assert_eq!(receipt.nr_share, 50_000_000);
    assert!(!receipt.refunded);

    let xlm = TokenClient::new(&f.env, &f.xlm_id);
    assert_eq!(xlm.balance(&f.treasury), 9_950_000_000);
    assert_eq!(xlm.balance(&f.nr_reserve), 50_000_000);
    assert_eq!(xlm.balance(&f.payer), 90_000_000_000);

    let metrics = f.client.get_metrics();
    assert_eq!(metrics.total_orders_settled, 1);
    assert_eq!(metrics.total_volume_settled, gross);
    assert_eq!(metrics.total_owner_fees, 50_000_000);
    assert_eq!(metrics.total_reserve_fees, 50_000_000);

    // Replay attack must fail!
    let dup = f
        .client
        .try_settle_order(&f.payer, &f.xlm_id, &gross, &order_ref);
    assert_eq!(dup, Err(Ok(VaultError::OrderAlreadySettled)));
}

#[test]
fn test_order_refund_and_double_refund_guard() {
    let f = setup_vault();
    let order_ref = ref_bytes(&f.env, 2);
    let gross: i128 = 5_000_000_000;

    f.client
        .settle_order(&f.payer, &f.xlm_id, &gross, &order_ref);

    // Fund relayer so relayer can execute refund
    StellarAssetClient::new(&f.env, &f.xlm_id).mint(&f.relayer, &gross);

    // Partial refund 1: 2,000_000_000 stroops
    let part1 = f.client.refund_order(&f.relayer, &order_ref, &2_000_000_000);
    assert!(!part1.refunded);
    assert_eq!(part1.refund_amount, 2_000_000_000);

    // Partial refund exceeding remaining balance must fail
    let over_err = f.client.try_refund_order(&f.relayer, &order_ref, &4_000_000_000);
    assert_eq!(over_err, Err(Ok(VaultError::RefundExceedsOrder)));

    // Partial refund 2: remaining 3,000_000_000 stroops -> marks order fully refunded
    let refunded = f.client.refund_order(&f.relayer, &order_ref, &3_000_000_000);
    assert!(refunded.refunded);
    assert_eq!(refunded.refund_amount, gross);

    let xlm = TokenClient::new(&f.env, &f.xlm_id);
    assert_eq!(xlm.balance(&f.payer), 100_000_000_000);

    // Double refund must be rejected
    let second = f.client.try_refund_order(&f.relayer, &order_ref, &1);
    assert_eq!(second, Err(Ok(VaultError::OrderAlreadyRefunded)));
}

#[test]
fn test_nxl_mint_cap_burn_and_bridge_burn() {
    let f = setup_vault();
    let nxl = TokenClient::new(&f.env, &f.nxl_id);

    // 1. Relayer mints 500 NXL cashback (5_000_000_000 stroops)
    let cashback_ref = ref_bytes(&f.env, 10);
    let circ = f.client.mint_nxl(
        &f.relayer,
        &f.payer,
        &5_000_000_000,
        &symbol_short!("cashback"),
        &cashback_ref,
    );
    assert_eq!(nxl.balance(&f.payer), 5_000_000_000);
    assert_eq!(circ, 1_005_000_000_000);

    // Replay cashback mint must fail
    let dup_mint = f.client.try_mint_nxl(
        &f.relayer,
        &f.payer,
        &5_000_000_000,
        &symbol_short!("cashback"),
        &cashback_ref,
    );
    assert_eq!(dup_mint, Err(Ok(VaultError::ActionAlreadyProcessed)));

    // Minting above 1,000,000 NXL supply cap must fail
    let overflow_ref = ref_bytes(&f.env, 11);
    let cap_err = f.client.try_mint_nxl(
        &f.admin,
        &f.payer,
        &9_500_000_000_000,
        &symbol_short!("mint"),
        &overflow_ref,
    );
    assert_eq!(cap_err, Err(Ok(VaultError::SupplyCapExceeded)));

    // 2. Payer burns 200 NXL to bridge to XRPL
    let bridge_ref = ref_bytes(&f.env, 12);
    let xrpl_dest = String::from_str(&f.env, "rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp");
    let total_burned = f.client.burn_for_bridge(
        &f.payer,
        &2_000_000_000,
        &xrpl_dest,
        &bridge_ref,
    );
    assert_eq!(total_burned, 2_000_000_000);
    assert_eq!(nxl.balance(&f.payer), 3_000_000_000);

    let metrics = f.client.get_metrics();
    assert_eq!(metrics.total_nxl_burned, 2_000_000_000);
    assert_eq!(metrics.total_bridge_burns, 1);
    assert_eq!(metrics.circulating_nxl, 1_003_000_000_000);
    // Bridge burn keeps effective cap at 10_000_000_000_000, so remaining = 8_997_000_000_000
    assert_eq!(metrics.remaining_mintable_nxl, 8_997_000_000_000);

    // 3. Deflationary buyback burn (100 NXL = 1_000_000_000 stroops) permanently reduces effective cap!
    let buyback_ref = ref_bytes(&f.env, 13);
    f.client.burn_nxl(
        &f.payer,
        &1_000_000_000,
        &symbol_short!("buyback"),
        &buyback_ref,
    );
    let metrics_after_bb = f.client.get_metrics();
    assert_eq!(metrics_after_bb.total_nxl_burned, 3_000_000_000);
    assert_eq!(metrics_after_bb.circulating_nxl, 1_002_000_000_000);
    // Effective cap is now 9_999_000_000_000 -> remaining stays 8_997_000_000_000 (cannot re-mint buyback burn!)
    assert_eq!(metrics_after_bb.remaining_mintable_nxl, 8_997_000_000_000);

    // Attempting to mint 8_997_500_000_000 (which would fit under original 10T cap but exceeds effective 9.999T cap) must fail!
    let cap_test_ref = ref_bytes(&f.env, 14);
    let bb_cap_err = f.client.try_mint_nxl(
        &f.admin,
        &f.payer,
        &8_997_500_000_000,
        &symbol_short!("admin"),
        &cap_test_ref,
    );
    assert_eq!(bb_cap_err, Err(Ok(VaultError::SupplyCapExceeded)));
}

#[test]
fn test_pause_rbac_and_two_step_admin_transfer() {
    let f = setup_vault();

    // Unauthorized caller cannot pause
    let rogue = Address::generate(&f.env);
    assert_eq!(
        f.client.try_set_paused(&rogue, &true),
        Err(Ok(VaultError::Unauthorized))
    );

    // Pauser can pause; settlements blocked while paused
    f.client.set_paused(&f.pauser, &true);
    let paused_res = f
        .client
        .try_settle_order(&f.payer, &f.xlm_id, &1_000_000, &ref_bytes(&f.env, 99));
    assert_eq!(paused_res, Err(Ok(VaultError::ContractPaused)));

    // Admin unpauses
    f.client.set_paused(&f.admin, &false);

    // 2-step Admin transfer
    let new_admin = Address::generate(&f.env);
    f.client.propose_admin(&new_admin);
    assert_eq!(f.client.get_config().pending_admin, Some(new_admin.clone()));
    let accepted = f.client.accept_admin();
    assert_eq!(accepted, new_admin);
    assert_eq!(f.client.get_config().admin, new_admin);
    assert_eq!(f.client.get_config().pending_admin, None);
}
