import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { xrplProvider } from '../src/services/crypto/index.js';

describe('Suite: XRPL WebSocket Resilience & Auto-Reconnect', () => {
  after(async () => {
    await xrplProvider.disconnect();
  });

  test('Ping succeeds against active XRPL testnet node', async () => {
    const isHealthy = await xrplProvider.ping();
    assert.equal(isHealthy, true, 'XRPL node ping must return true');
  });

  test('Auto-reconnects seamlessly after client is forcibly disconnected', async () => {
    // 1. Explicitly drop connection
    await xrplProvider.disconnect();

    // 2. Subsequent call to getAccountBalance must auto-reconnect without throwing
    const balanceInfo = await xrplProvider.getAccountBalance();
    assert.equal(balanceInfo.currency, 'XRP');
    assert.ok(typeof balanceInfo.balance === 'number');
    assert.ok(balanceInfo.balance >= 0);
  });
});
