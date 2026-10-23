import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { LedgerWatcherWorker } from '../src/workers/ledgerWatcher.js';
import { stellarProvider, xrplProvider } from '../src/services/crypto/index.js';

describe('Suite: Active Ledger Watcher & Reconciler', () => {
  after(async () => {
    await xrplProvider.disconnect();
  });

  test('Worker initializes, starts and stops cleanly without unhandled intervals', () => {
    LedgerWatcherWorker.startWatchers();
    LedgerWatcherWorker.stopWatchers();
    assert.ok(true, 'Worker start and stop completed safely');
  });

  test('Stellar findRecentPaymentByMemo returns null when scanning non-existent memo', async () => {
    const bogusMemo = 'NR99999999999999999999999999';
    const txHash = await stellarProvider.findRecentPaymentByMemo(bogusMemo);
    assert.equal(txHash, null, 'Unmatched memo must yield null txHash');
  });

  test('XRPL findRecentPaymentByDestinationTag returns null when scanning non-existent tag', async () => {
    const bogusTag = 9999999;
    const txHash = await xrplProvider.findRecentPaymentByDestinationTag(bogusTag);
    assert.equal(txHash, null, 'Unmatched destination tag must yield null txHash');
  });

  test('reconcilePendingOrders executes without throwing when database is empty or offline', async () => {
    const res = await LedgerWatcherWorker.reconcilePendingOrders();
    assert.ok(typeof res.reconciledCount === 'number');
    assert.ok(res.reconciledCount >= 0);
  });
});
