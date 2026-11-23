import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioService, CASHOUT_SPREAD_BPS } from '../src/services/portfolio.service.js';
import { ProductService } from '../src/services/products.js';
import { NrTokenService } from '../src/services/nrToken.service.js';
import { walletService } from '../src/services/wallet.js';
import { MongoService, MongoOrderDoc } from '../src/services/mongo.js';
import crypto from 'crypto';

describe('Suite: Module 3 — User Live Portfolio, Cost Basis, Unrealized P&L & 1-Click Cashout', () => {
  const testUserId = `test_usr_m3_${crypto.randomBytes(4).toString('hex')}`;

  before(async () => {
    await ProductService.ensureSeed();
  });

  after(async () => {
    try {
      const db = await MongoService.getDb();
      await db.collection('user_holdings').deleteMany({ user_id: testUserId });
      await db.collection('portfolio_events').deleteMany({ user_id: testUserId });
      await db.collection('orders').deleteMany({ user_id: testUserId });
      await db.collection('wallet_balances').deleteMany({ user_id: testUserId });
    } catch {}
    await MongoService.close();
  });

  test('T3.1: creditOrderAllocations decomposes Smart Basket into constituent holdings with live acquisition prices', async () => {
    const mockOrder: MongoOrderDoc = {
      id: `ord_${crypto.randomUUID()}`,
      user_id: testUserId,
      order_number: `NR-TEST-BASKET-${Date.now()}`,
      total_cents: 10450,
      payment_rail: 'STRIPE',
      status: 'PAID',
      items: [
        {
          sku: 'BASKET-INFLATION-SHIELD',
          title: 'Inflation Shield Basket',
          priceCents: 10450,
          qty: 2, // 2 baskets = 1.0g Gold, 40.0g Silver, 60.0 USDC
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne(mockOrder);

    const credited = await PortfolioService.creditOrderAllocations(mockOrder);
    assert.equal(credited, true, 'First-time order allocation credit must succeed');

    const portfolio = await PortfolioService.getUserPortfolio(testUserId);
    assert.equal(portfolio.user_id, testUserId);

    // Verify decomposed assets exist: Gold, Silver, USDC
    const goldHolding = portfolio.holdings.find((h) => h.symbol === 'GOLD_G');
    const silverHolding = portfolio.holdings.find((h) => h.symbol === 'SILVER_G');
    const usdcHolding = portfolio.holdings.find((h) => h.symbol === 'USDC');

    assert.ok(goldHolding, 'Gold holding must be credited');
    assert.equal(goldHolding.quantity, 1.0, '2 baskets * 0.5g = 1.0g Gold');
    assert.ok(goldHolding.total_cost_cents > 0, 'Cost basis must be positive');

    assert.ok(silverHolding, 'Silver holding must be credited');
    assert.equal(silverHolding.quantity, 40.0, '2 baskets * 20g = 40.0g Silver');

    assert.ok(usdcHolding, 'USDC holding must be credited');
    assert.equal(usdcHolding.quantity, 60.0, '2 baskets * 30 USDC = 60.0 USDC');
    assert.equal(usdcHolding.current_price_cents, 100, 'USDC oracle unit price must be exactly 100 cents');
  });

  test('T3.2: Strict Idempotency Defense: Replay attempt returns false and blocks duplicate asset crediting', async () => {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const existingOrder = await ordersCol.findOne({ user_id: testUserId, items: { $elemMatch: { sku: 'BASKET-INFLATION-SHIELD' } } });
    assert.ok(existingOrder, 'Must find seeded test order');

    // Attempt second credit call on the already-credited order
    const replayCredit = await PortfolioService.creditOrderAllocations(existingOrder);
    assert.equal(replayCredit, false, 'Replaying credit on an already credited order must return false');

    const portfolio = await PortfolioService.getUserPortfolio(testUserId);
    const goldHolding = portfolio.holdings.find((h) => h.symbol === 'GOLD_G');
    assert.equal(goldHolding?.quantity, 1.0, 'Holding quantity must remain strictly 1.0g without double-credit inflation');
  });

  test('T3.3: Weighted-Average Cost Basis (WAC) recalculates accurately across multiple acquisitions at varying prices', async () => {
    // Acquire a 1g Gold pack
    const mockOrder2: MongoOrderDoc = {
      id: `ord_${crypto.randomUUID()}`,
      user_id: testUserId,
      order_number: `NR-TEST-GOLD2-${Date.now()}`,
      total_cents: 8600,
      payment_rail: 'STELLAR',
      status: 'PAID',
      items: [
        {
          sku: 'NGOLD-1G',
          title: 'Physical 24K Gold 1g Pack',
          priceCents: 8600,
          qty: 1, // +1.0g Gold (Total now = 2.0g)
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne(mockOrder2);

    const credited = await PortfolioService.creditOrderAllocations(mockOrder2);
    assert.equal(credited, true);

    const portfolio = await PortfolioService.getUserPortfolio(testUserId);
    const goldHolding = portfolio.holdings.find((h) => h.symbol === 'GOLD_G');
    assert.ok(goldHolding);
    assert.equal(goldHolding.quantity, 2.0, 'Total gold quantity must be 2.0g');

    // Expected WAC = total_cost_cents / 2.0
    const expectedAvg = Math.round(goldHolding.total_cost_cents / 2.0);
    assert.equal(goldHolding.avg_buy_price_cents, expectedAvg, 'WAC must equal total_cost / total_quantity');
  });

  test('T3.4: getUserPortfolio returns live valuation, unrealized P&L ($ and %), and INR conversion', async () => {
    const portfolio = await PortfolioService.getUserPortfolio(testUserId);
    assert.ok(portfolio.total_cost_cents > 0, 'Total cost must be positive');
    assert.ok(portfolio.total_current_value_cents > 0, 'Total current market value must be positive');
    assert.ok(typeof portfolio.total_unrealized_pnl_cents === 'number', 'Unrealized P&L in cents must be numeric');
    assert.ok(typeof portfolio.total_unrealized_pnl_percent === 'number', 'Unrealized P&L % must be numeric');
    assert.ok(portfolio.inr_total_current_value > 0, 'INR valuation must be positive');
    assert.ok(portfolio.recent_events.length >= 2, 'Portfolio audit log must contain order events');
  });

  test('T3.5: 1-Click Cashout Overdraft Defense: Reject attempt to liquidate more units than owned', async () => {
    await assert.rejects(
      async () => {
        await PortfolioService.sellHolding(testUserId, {
          symbol: 'GOLD_G',
          quantity: 999.0, // User only owns 2.0g
        });
      },
      /Insufficient/i,
      'Attempting to sell more than owned balance must reject with Insufficient holding balance'
    );
  });

  test('T3.6: 1-Click Cashout Execution: Liquidates position, deducts 0.50% spread, and credits USD balance', async () => {
    const initialBalances = await walletService.getBalance(testUserId);
    const initialUsd = initialBalances.USD || 0;

    // Sell 1.0g Gold out of 2.0g owned
    const sellRes = await PortfolioService.sellHolding(testUserId, {
      symbol: 'GOLD_G',
      quantity: 1.0,
    });

    assert.equal(sellRes.success, true);
    assert.equal(sellRes.symbol, 'GOLD_G');
    assert.equal(sellRes.quantity_sold, 1.0);
    assert.equal(sellRes.remaining_quantity, 1.0, '2.0g - 1.0g = 1.0g remaining');
    assert.ok(sellRes.gross_proceeds_cents > 0, 'Gross proceeds must be positive');

    // 0.50% spread verification
    const expectedSpread = Math.round((sellRes.gross_proceeds_cents * CASHOUT_SPREAD_BPS) / 10000);
    assert.equal(sellRes.spread_fee_cents, expectedSpread, 'Spread fee must be exactly 0.50% (50 bps)');
    assert.equal(sellRes.net_payout_cents, sellRes.gross_proceeds_cents - expectedSpread, 'Net payout = gross - spread');

    // USD balance must increase by net_payout_cents
    const updatedBalances = await walletService.getBalance(testUserId);
    assert.equal(updatedBalances.USD, initialUsd + sellRes.net_payout_cents, 'User USD wallet must be credited net payout');
  });

  test('T3.7: Platform AUC Aggregation: getPlatformAUC returns system-wide custody liabilities and spread fees', async () => {
    const auc = await PortfolioService.getPlatformAUC();
    assert.ok(auc.total_custody_usd_cents > 0, 'Total platform AUC must be positive');
    assert.ok(auc.assets.length > 0, 'Must have active custody assets');

    const goldAsset = auc.assets.find((a) => a.symbol === 'GOLD_G');
    assert.ok(goldAsset, 'Gold must appear in platform AUC table');
    assert.ok(goldAsset.total_quantity >= 1.0, 'Gold total quantity must be >= 1.0g');
    assert.ok(goldAsset.user_count >= 1, 'Active gold user count must be >= 1');

    assert.ok(auc.total_spread_earned_cents > 0, 'Platform spread earned must record the cashout spread fee');
    assert.ok(auc.recent_liquidations.length >= 1, 'Must include the recent cashout liquidation');
  });
});
