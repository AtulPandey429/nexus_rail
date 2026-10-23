import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import { TransactionBuilder, Networks } from '@stellar/stellar-sdk';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import {
  chainRegistry,
  stellarUsdcProvider,
  CIRCLE_USDC_TESTNET_ISSUER,
} from '../src/services/crypto/index.js';
import { MongoService, MongoOrderDoc } from '../src/services/mongo.js';
import { checkoutRouter } from '../src/routes/checkout.js';
import { signToken } from '../src/services/jwt.js';

describe('Suite: Native Stellar USDC Stablecoin Settlement Rail (FEAT-03)', () => {
  let server: http.Server;
  let port: number;
  let authToken: string;
  const testUserId = `user_usdc_${Date.now()}`;
  const testOrderId = `ord_usdc_${Date.now()}`;
  // Standard Stellar Testnet public key for building XDR tests
  const testSourcePublicKey = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';

  before(async () => {
    authToken = signToken({ id: testUserId, role: 'user' });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/checkout', checkoutRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      await ordersCol.deleteMany({ id: testOrderId });
    } catch {}
    await MongoService.close();
  });

  it('chainRegistry registers stellar-usdc provider and metadata matches specification', () => {
    const provider = chainRegistry.getRequiredProvider('stellar-usdc');
    assert.ok(provider);
    assert.equal(provider.chainId, 'stellar-usdc');
    assert.equal(provider.assetSymbol, 'USDC');
    assert.equal(provider.network, 'testnet');
    assert.equal(stellarUsdcProvider.chainId, 'stellar-usdc');
  });

  it('createInvoice calculates exact 1:1 USD valuation with Circle USDC parameters', async () => {
    const invoice = await stellarUsdcProvider.createInvoice('ord_test_usdc_invoice', 12900);

    assert.equal(invoice.orderId, 'ord_test_usdc_invoice');
    assert.equal(invoice.amountAsset, 129.0);
    assert.equal(invoice.assetSymbol, 'USDC');
    assert.equal(invoice.fxRateUsd, 1.0);
    assert.equal(invoice.paymentIdentifierType, 'memo_text');
    assert.ok(String(invoice.paymentIdentifier).startsWith('NR'));
    assert.equal(String(invoice.paymentIdentifier).length, 28);
    assert.match(invoice.qrPayload, /asset_code=USDC/);
    assert.match(invoice.qrPayload, new RegExp(CIRCLE_USDC_TESTNET_ISSUER));
  });

  it('buildPaymentXdr constructs a valid Stellar payment operation with Circle USDC asset', async () => {
    const memo = 'NRTESTMEMO1234567890ABCDEFGH';
    const xdr = await stellarUsdcProvider.buildPaymentXdr(testSourcePublicKey, 49.99, memo);

    assert.ok(typeof xdr === 'string');
    assert.ok(xdr.length > 50);

    // Decode and verify the XDR envelope
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as any;
    assert.equal(tx.operations.length, 1);

    const op = tx.operations[0];
    assert.equal(op.type, 'payment');
    assert.equal(op.amount, '49.9900000');
    assert.equal(op.asset.code, 'USDC');
    assert.equal(op.asset.issuer, CIRCLE_USDC_TESTNET_ISSUER);
    assert.equal(tx.memo.value.toString('utf8'), memo);
  });

  it('POST /api/v1/checkout/stellar-usdc/create-invoice creates order invoice with 1:1 USDC rate', async () => {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne({
      id: testOrderId,
      order_number: `NR-USDC-${Date.now()}`,
      user_id: testUserId,
      total_cents: 9900, // $99.00
      items: [],
      payment_rail: 'STELLAR_USDC',
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);

    const res = await fetch(`http://localhost:${port}/api/v1/checkout/stellar-usdc/create-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ orderId: testOrderId }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.invoice);
    assert.equal(body.invoice.assetSymbol, 'USDC');
    assert.equal(body.invoice.amountAsset, 99.0);
    assert.equal(body.invoice.amount, '99');
    assert.equal(body.invoice.fxRateUsd, 1.0);
    assert.ok(body.invoice.memo.startsWith('NR'));
  });

  it('POST /api/v1/checkout/stellar-usdc/prepare-xdr generates client-signable Circle USDC XDR', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/checkout/stellar-usdc/prepare-xdr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ orderId: testOrderId, sourcePublicKey: testSourcePublicKey }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.xdr);
    assert.equal(body.assetSymbol, 'USDC');
    assert.equal(body.amountUsdc, 99.0);
    assert.equal(body.networkPassphrase, 'Test SDF Network ; September 2015');
  });
});
