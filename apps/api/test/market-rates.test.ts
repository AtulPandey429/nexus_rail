import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { usdCentsToAsset, getFxQuote } from '../src/services/market.js';

describe('Suite: FX Rates & Conversion Math', () => {
  test('getFxQuote returns valid numeric quotes with usd = 1', async () => {
    const fx = await getFxQuote();
    assert.equal(fx.usd, 1);
    assert.ok(typeof fx.xrpUsd === 'number' && fx.xrpUsd > 0, 'XRP rate must be positive number');
    assert.ok(typeof fx.xlmUsd === 'number' && fx.xlmUsd > 0, 'XLM rate must be positive number');
    assert.ok(['coingecko', 'binance', 'fallback'].includes(fx.source));
  });

  test('usdCentsToAsset correctly calculates token quantities', async () => {
    // $100.00 USD (10000 cents)
    const xrp = await usdCentsToAsset(10000, 'XRP');
    const xlm = await usdCentsToAsset(10000, 'XLM');

    assert.ok(typeof xrp === 'number' && xrp > 0);
    assert.ok(typeof xlm === 'number' && xlm > 0);

    // Assert positive finite floating-point value with precision
    assert.ok(Number.isFinite(xrp));
    assert.ok(Number.isFinite(xlm));
  });

  test('usdCentsToAsset scales linearly with order amount', async () => {
    const xrpSmall = await usdCentsToAsset(1000, 'XRP'); // $10
    const xrpLarge = await usdCentsToAsset(10000, 'XRP'); // $100

    const ratio = xrpLarge / xrpSmall;
    assert.ok(Math.abs(ratio - 10) < 0.01, 'Scaling factor must match cents ratio');
  });
});
