import test from 'node:test';
import assert from 'node:assert/strict';
import { Client, dropsToXrp } from 'xrpl';
import { Horizon } from '@stellar/stellar-sdk';
import { env } from '../src/config/env.js';
import { MongoService } from '../src/services/mongo.js';

test('Suite: Ledger On-Chain Transaction Queries & Swap History', async (t) => {
  await t.test('Queries real on-chain transactions for XRPL account r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt', async () => {
    const client = new Client(env.XRPL_WSS || 'wss://s.altnet.rippletest.net:51233');
    await client.connect();
    const res = await client.request({
      command: 'account_tx',
      account: 'r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt',
      limit: 5,
    });
    await client.disconnect();

    assert.ok(Array.isArray(res.result.transactions));
    assert.ok(res.result.transactions.length > 0);
    const firstTx = res.result.transactions[0].tx_json || res.result.transactions[0].tx;
    assert.ok(firstTx.Account);
    assert.ok(res.result.transactions[0].hash);
  });

  await t.test('Queries real on-chain payments for Stellar user account GBS6IALQNERJAK23Z6NWCNF2UFDWUPZA5G2KD6B3DZO3UTOJK2XTN7ML', async () => {
    const server = new Horizon.Server(
      env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org'
    );
    const payments = await server.payments().forAccount('GBS6IALQNERJAK23Z6NWCNF2UFDWUPZA5G2KD6B3DZO3UTOJK2XTN7ML').order('desc').limit(5).call();
    assert.ok(Array.isArray(payments.records));
    assert.ok(payments.records.length > 0);

    // Verify recent NXL payment exists in records
    const nxlPayment = payments.records.find((p: any) => p.asset_code === 'NXL' || (p.type === 'payment' && p.asset_code === 'NXL'));
    assert.ok(nxlPayment, 'Found real on-chain NXL payment to user on Stellar Testnet');
  });

  await t.test('Queries real cross-chain bridge logs from MongoDB platform_chain_logs', async () => {
    const logsCol = await MongoService.getCollection<any>('platform_chain_logs');
    const logs = await logsCol.find({ action: 'CROSS_CHAIN_BRIDGE' }).sort({ created_at: -1 }).limit(5).toArray();
    assert.ok(Array.isArray(logs));
    assert.ok(logs.length > 0);
    assert.ok(logs[0].tx_hash);
    assert.ok(logs[0].explorer_url);
  });
});
