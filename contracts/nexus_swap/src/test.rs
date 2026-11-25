#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env, String,
};

struct SwapFixture<'a> {
    env: Env,
    admin: Address,
    relayer: Address,
    treasury: Address,
    lp: Address,
    trader: Address,
    xlm_id: Address,
    nxl_id: Address,
    client: NexusSwapContractClient<'a>,
}

fn setup_swap<'a>() -> SwapFixture<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.timestamp = 1_700_000_000;
    });

    let admin = Address::generate(&env);
    let relayer = Address::generate(&env);
    let treasury = Address::generate(&env);
    let lp = Address::generate(&env);
    let trader = Address::generate(&env);

    let xlm_admin = Address::generate(&env);
    let xlm_id = env.register_stellar_asset_contract_v2(xlm_admin).address();

    let nxl_admin = Address::generate(&env);
    let nxl_id = env.register_stellar_asset_contract_v2(nxl_admin).address();

    // Mint 100,000 XLM and 100,000 NXL to LP, 10,000 XLM + 10,000 NXL to trader
    StellarAssetClient::new(&env, &xlm_id).mint(&lp, &1_000_000_000_000);
    StellarAssetClient::new(&env, &nxl_id).mint(&lp, &1_000_000_000_000);
    StellarAssetClient::new(&env, &xlm_id).mint(&trader, &100_000_000_000);
    StellarAssetClient::new(&env, &nxl_id).mint(&trader, &100_000_000_000);

    let swap_id = env.register(
        NexusSwapContract,
        (
            admin.clone(),
            relayer.clone(),
            treasury.clone(),
            xlm_id.clone(),
            nxl_id.clone(),
            50u32, // 0.50% swap fee
            50u32, // 50% Owner / 50% Pool Reserve
        ),
    );

    let env_clone = env.clone();
    let client = NexusSwapContractClient::new(&env_clone, &swap_id);

    SwapFixture {
        env,
        admin,
        relayer,
        treasury,
        lp,
        trader,
        xlm_id,
        nxl_id,
        client,
    }
}

#[test]
fn test_amm_liquidity_swap_fee_split_and_invariant() {
    let f = setup_swap();

    // Seed pool with 10,000 XLM & 10,000 NXL (1:1 initial price)
    let shares = f
        .client
        .add_liquidity(&f.lp, &100_000_000_000, &100_000_000_000, &1);
    assert_eq!(shares, 100_000_000_000);
    assert_eq!(f.client.get_lp_balance(&f.lp), shares);

    // Quote swapping 1,000 XLM -> NXL
    let amount_in: i128 = 10_000_000_000;
    let quote = f.client.quote_swap(&f.xlm_id, &amount_in);
    // 0.50% of 1000 XLM = 5 XLM total fee -> 2.5 XLM owner_fee + 2.5 XLM pool_fee
    assert_eq!(quote.total_fee, 50_000_000);
    assert_eq!(quote.owner_fee, 25_000_000);
    assert_eq!(quote.pool_fee, 25_000_000);
    assert!(quote.amount_out > 9_000_000_000 && quote.amount_out < 10_000_000_000);

    // Execute swap with slippage protection & deadline
    let deadline = 1_700_000_300;
    let receipt = f.client.swap_exact_in(
        &f.trader,
        &f.xlm_id,
        &amount_in,
        &quote.amount_out,
        &deadline,
    );
    assert_eq!(receipt.amount_out, quote.amount_out);
    assert_eq!(receipt.owner_fee, 25_000_000);

    // Owner treasury received 2.5 XLM immediately
    let xlm = TokenClient::new(&f.env, &f.xlm_id);
    assert_eq!(xlm.balance(&f.treasury), 25_000_000);

    // Pool invariant k grew strictly due to retained pool_fee
    let state = f.client.get_pool_state();
    assert_eq!(state.total_swaps, 1);
    assert!(state.reserve_a * state.reserve_b > 100_000_000_000i128 * 100_000_000_000i128);

    // Slippage protection must revert if min_amount_out is too high
    let slip_err = f.client.try_swap_exact_in(
        &f.trader,
        &f.xlm_id,
        &amount_in,
        &99_000_000_000,
        &deadline,
    );
    assert_eq!(slip_err, Err(Ok(SwapError::SlippageExceeded)));

    // Expired deadline must revert
    let exp_err = f.client.try_swap_exact_in(
        &f.trader,
        &f.xlm_id,
        &amount_in,
        &1,
        &1_699_999_000,
    );
    assert_eq!(exp_err, Err(Ok(SwapError::DeadlineExpired)));

    // Remove 50% LP shares cleanly
    let (out_a, out_b) = f.client.remove_liquidity(&f.lp, &(shares / 2), &1, &1);
    assert!(out_a > 50_000_000_000);
    assert!(out_b > 40_000_000_000);
}

#[test]
fn test_cross_chain_bridge_escrow_release_and_expired_refund() {
    let f = setup_swap();
    let xlm = TokenClient::new(&f.env, &f.xlm_id);

    // Seed AMM pool first so we also prove escrow funds stay 100% isolated from AMM reserves!
    f.client
        .add_liquidity(&f.lp, &50_000_000_000, &50_000_000_000, &1);
    let state_before = f.client.get_pool_state();

    // 1. Lock 500 XLM in escrow for XRPL swap
    let swap_id_1 = BytesN::from_array(&f.env, &[7u8; 32]);
    let xrpl_dest = String::from_str(&f.env, "rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp");
    let expiry = 1_700_000_900; // +15 mins
    let escrow = f.client.lock_bridge_escrow(
        &f.trader,
        &f.xlm_id,
        &5_000_000_000,
        &swap_id_1,
        &xrpl_dest,
        &expiry,
    );
    assert_eq!(escrow.status, EscrowStatus::Locked);

    // AMM reserves untouched!
    assert_eq!(f.client.get_pool_state().reserve_a, state_before.reserve_a);

    // Relayer releases escrow to treasury after XRPL payout proof
    let xrpl_hash = String::from_str(&f.env, "ABCDEF1234567890XRPLHASH");
    let released = f.client.release_bridge_escrow(
        &f.relayer,
        &swap_id_1,
        &f.treasury,
        &xrpl_hash,
    );
    assert_eq!(released.status, EscrowStatus::Released);
    assert_eq!(xlm.balance(&f.treasury), 5_000_000_000);

    // Double release must fail
    let dup_rel = f.client.try_release_bridge_escrow(
        &f.relayer,
        &swap_id_1,
        &f.treasury,
        &xrpl_hash,
    );
    assert_eq!(dup_rel, Err(Ok(SwapError::EscrowNotLocked)));

    // 2. Second escrow expires -> user self-recovers 100% funds without admin!
    let swap_id_2 = BytesN::from_array(&f.env, &[8u8; 32]);
    let trader_bal_before = xlm.balance(&f.trader);
    f.client.lock_bridge_escrow(
        &f.trader,
        &f.xlm_id,
        &2_000_000_000,
        &swap_id_2,
        &xrpl_dest,
        &expiry,
    );

    // Trader CANNOT self-refund before expiry
    let early_err = f.client.try_refund_expired_escrow(&f.trader, &swap_id_2);
    assert_eq!(early_err, Err(Ok(SwapError::Unauthorized)));

    // Advance ledger past expiry -> Trader self-recovers 100%
    f.env.ledger().with_mut(|li| {
        li.timestamp = expiry + 1;
    });
    let refunded = f.client.refund_expired_escrow(&f.trader, &swap_id_2);
    assert_eq!(refunded.status, EscrowStatus::Refunded);
    assert_eq!(xlm.balance(&f.trader), trader_bal_before);

    // 3. Audit $NXL (token_b) bridge escrow separately (Decision D3 Option A)
    let nxl = TokenClient::new(&f.env, &f.nxl_id);
    let nxl_bal_before = nxl.balance(&f.trader);
    let swap_id_nxl = BytesN::from_array(&f.env, &[9u8; 32]);
    let expiry_nxl = expiry + 900;
    let nxl_escrow = f.client.lock_bridge_escrow(
        &f.trader,
        &f.nxl_id,
        &3_000_000_000,
        &swap_id_nxl,
        &xrpl_dest,
        &expiry_nxl,
    );
    assert_eq!(nxl_escrow.status, EscrowStatus::Locked);
    assert_eq!(nxl_escrow.token, f.nxl_id);
    assert_eq!(f.client.get_pool_state().reserve_b, state_before.reserve_b);

    // Advance past NXL escrow expiry and verify 100% NXL self-refund
    f.env.ledger().with_mut(|li| {
        li.timestamp = expiry_nxl + 1;
    });
    let refunded_nxl = f.client.refund_expired_escrow(&f.trader, &swap_id_nxl);
    assert_eq!(refunded_nxl.status, EscrowStatus::Refunded);
    assert_eq!(nxl.balance(&f.trader), nxl_bal_before);

    // 4. Reject arbitrary unapproved token in lock_bridge_escrow
    let rogue_token = Address::generate(&f.env);
    let swap_id_bad = BytesN::from_array(&f.env, &[10u8; 32]);
    let bad_tok_err = f.client.try_lock_bridge_escrow(
        &f.trader,
        &rogue_token,
        &1_000_000,
        &swap_id_bad,
        &xrpl_dest,
        &(expiry_nxl + 1800),
    );
    assert_eq!(bad_tok_err, Err(Ok(SwapError::InvalidToken)));
}

#[test]
fn test_reverse_swap_nxl_to_xlm_pause_and_admin_transfer() {
    let f = setup_swap();

    // Seed pool
    f.client
        .add_liquidity(&f.lp, &100_000_000_000, &100_000_000_000, &1);

    // Reverse swap: 500 NXL -> XLM
    let amount_in: i128 = 5_000_000_000;
    let quote = f.client.quote_swap(&f.nxl_id, &amount_in);
    let receipt = f.client.swap_exact_in(
        &f.trader,
        &f.nxl_id,
        &amount_in,
        &quote.amount_out,
        &1_700_000_600,
    );
    assert_eq!(receipt.token_in, f.nxl_id);
    assert_eq!(receipt.token_out, f.xlm_id);
    assert_eq!(receipt.amount_out, quote.amount_out);

    let nxl = TokenClient::new(&f.env, &f.nxl_id);
    assert_eq!(nxl.balance(&f.treasury), receipt.owner_fee);

    // Pause blocks swaps
    f.client.set_paused(&true);
    let paused = f
        .client
        .try_swap_exact_in(&f.trader, &f.nxl_id, &amount_in, &1, &1_700_000_600);
    assert_eq!(paused, Err(Ok(SwapError::ContractPaused)));
    f.client.set_paused(&false);

    // 2-step admin handover
    assert_eq!(f.client.get_pool_state().admin, f.admin);
    let next_admin = Address::generate(&f.env);
    f.client.propose_admin(&next_admin);
    let accepted = f.client.accept_admin();
    assert_eq!(accepted, next_admin);
    assert_eq!(f.client.get_pool_state().admin, next_admin);
}
