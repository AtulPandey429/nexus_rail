import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

describe('Suite: Dual-Rail Cryptographic Identifier Derivation', () => {
  const orderId = 'ORD-2026-NEXUS-9876';

  test('Stellar: Derives an authoritative 28-byte uppercase alphanumeric memo starting with NR', () => {
    const memoHash = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(orderId).digest('hex');
    const memoText = (`NR${memoHash}`).slice(0, 28).toUpperCase();

    assert.equal(memoText.length, 28, 'Stellar memo_text must be exactly 28 bytes');
    assert.ok(memoText.startsWith('NR'), 'Memo must start with domain prefix NR');
    assert.match(memoText, /^NR[A-F0-9]{26}$/, 'Memo must match NR followed by 26 hex chars');

    // Determinism check: Same orderId must always yield the exact same memo
    const memoHash2 = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(orderId).digest('hex');
    const memoText2 = (`NR${memoHash2}`).slice(0, 28).toUpperCase();
    assert.equal(memoText, memoText2);
  });

  test('Stellar: Different order IDs produce different collision-resistant memos', () => {
    const memo1 = (`NR${crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update('ORD-A').digest('hex')}`).slice(0, 28).toUpperCase();
    const memo2 = (`NR${crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update('ORD-B').digest('hex')}`).slice(0, 28).toUpperCase();
    assert.notEqual(memo1, memo2);
  });

  test('XRPL: Computes a deterministic 32-bit unsigned destination tag in safe ledger range [100000, 2099999999]', () => {
    const tagDigest = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_tag').update(orderId).digest();
    const destinationTag = (tagDigest.readUInt32BE(0) % 2_000_000_000) + 100_000;

    assert.ok(Number.isInteger(destinationTag), 'Destination tag must be an integer');
    assert.ok(destinationTag >= 100_000, 'Destination tag must be >= 100,000');
    assert.ok(destinationTag <= 2_147_483_647, 'Destination tag must fit within 32-bit unsigned int');

    // Determinism
    const tagDigest2 = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_tag').update(orderId).digest();
    const destinationTag2 = (tagDigest2.readUInt32BE(0) % 2_000_000_000) + 100_000;
    assert.equal(destinationTag, destinationTag2);
  });

  test('Web Crypto vs Node Crypto: Browser subtle crypto yields 100% identical Stellar memo & XRPL tag', async () => {
    // Node crypto baseline
    const expectedMemo = (`NR${crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(orderId).digest('hex')}`).slice(0, 28).toUpperCase();
    const expectedTag = (crypto.createHmac('sha256', 'nexus_rail_settlement_v1_tag').update(orderId).digest().readUInt32BE(0) % 2_000_000_000) + 100_000;

    // Web Crypto standard API simulation (supported in modern browsers and Node 18+)
    const enc = new TextEncoder();
    const memoKey = await crypto.subtle.importKey(
      'raw',
      enc.encode('nexus_rail_settlement_v1_memo'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const memoSig = await crypto.subtle.sign('HMAC', memoKey, enc.encode(orderId));
    const browserMemo = ('NR' + Array.from(new Uint8Array(memoSig)).map((b) => b.toString(16).padStart(2, '0')).join('')).slice(0, 28).toUpperCase();

    assert.equal(browserMemo, expectedMemo, 'Web Crypto memo must match Node crypto memo exactly');

    const tagKey = await crypto.subtle.importKey(
      'raw',
      enc.encode('nexus_rail_settlement_v1_tag'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const tagSig = new Uint8Array(await crypto.subtle.sign('HMAC', tagKey, enc.encode(orderId)));
    const uint32 = ((tagSig[0] << 24) | (tagSig[1] << 16) | (tagSig[2] << 8) | tagSig[3]) >>> 0;
    const browserTag = (uint32 % 2_000_000_000) + 100_000;

    assert.equal(browserTag, expectedTag, 'Web Crypto tag must match Node crypto tag exactly');
  });
});
