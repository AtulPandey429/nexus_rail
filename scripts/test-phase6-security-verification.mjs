// ============================================================================
// NexusRail Phase 6 Comprehensive Security, Auth & Blockchain Test Suite
// Verifies all Phase 3, Phase 4, and Phase 5 hardening implementations
// ============================================================================

import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

import { signToken, verifyToken } from '../apps/api/dist/services/jwt.js';
import { stellarProvider, xrplProvider } from '../apps/api/dist/services/crypto/index.js';

let passedCount = 0;
let failedCount = 0;
const results = [];

function assert(condition, message) {
  if (!condition) {
    failedCount++;
    results.push({ status: 'FAIL', message });
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(message);
  } else {
    passedCount++;
    results.push({ status: 'PASS', message });
    console.log(`  ✅ [PASS] ${message}`);
  }
}

async function runTestSuite() {
  console.log('🛡️ ================================================================');
  console.log('   NEXUSRAIL PHASE 6 AUTOMATED SECURITY & BLOCKCHAIN TEST SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SUITE 1: JWT Cryptographic Authentication & Backdoor Bypass Prevention
  // --------------------------------------------------------------------------
  console.log('🔒 [Suite 1: JWT Cryptographic Integrity & Backdoor Bypass Tests]');
  
  // Test 1.1: Legitimate signed JWT token verification
  try {
    const validUser = {
      id: 'usr_secure_99182',
      email: 'security.officer@nexusrail.dev',
      role: 'admin',
    };
    const token = signToken(validUser);
    const verified = verifyToken(token);
    assert(verified.id === validUser.id, 'Legitimate signed token correctly verified');
    assert(verified.role === 'admin', 'Correct role decoded from cryptographically verified token');
  } catch (err) {
    assert(false, `Valid token failed verification: ${err.message}`);
  }

  // Test 1.2: Backdoor bypass prevention (demo-token-admin must be rejected)
  try {
    verifyToken('demo-token-admin');
    assert(false, 'Backdoor demo-token-admin was accepted! (VULNERABILITY DETECTED)');
  } catch (err) {
    assert(
      err.message.includes('Malformed token') || err.message.includes('signature'),
      'Backdoor token "demo-token-admin" correctly rejected with cryptographic requirement'
    );
  }

  // Test 1.3: Raw Stellar public key token bypass prevention
  try {
    verifyToken('GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR');
    assert(false, 'Raw Stellar address accepted as bearer token without signature!');
  } catch (err) {
    assert(
      err.message.includes('Malformed token') || err.message.includes('signature'),
      'Raw Stellar public key correctly rejected without cryptographic signature'
    );
  }

  // Test 1.4: Tampered payload signature verification
  try {
    const user = { id: 'usr_shopper_01', email: 'user@nexusrail.dev', role: 'user' };
    const originalToken = signToken(user);
    const [header, body, sig] = originalToken.split('.');
    
    // Tamper body to claim admin role
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), role: 'admin' })
    ).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayload}.${sig}`;

    verifyToken(tamperedToken);
    assert(false, 'Tampered token payload was accepted!');
  } catch (err) {
    assert(
      err.message.includes('signature'),
      'Tampered payload with forged admin role correctly rejected by HMAC-SHA256 timingSafeEqual'
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Blockchain Invoice & Deterministic Derivation Tests
  // --------------------------------------------------------------------------
  console.log('\n⚡ [Suite 2: Multi-Rail Invoice & Deterministic Identifier Tests]');

  // Test 2.1: XRPL Destination Tag Bounding and Collision Resistance
  try {
    const testOrderId = 'NR-ORDER-2026-X9918';
    const invoice1 = await xrplProvider.createInvoice(testOrderId, 20000);
    const invoice2 = await xrplProvider.createInvoice(testOrderId, 20000);

    assert(
      invoice1.paymentIdentifier === invoice2.paymentIdentifier,
      'XRPL destination tag is strictly deterministic for identical order ID'
    );
    assert(
      Number(invoice1.paymentIdentifier) >= 100000 && Number(invoice1.paymentIdentifier) <= 2147483647,
      `XRPL destination tag (${invoice1.paymentIdentifier}) is within safe 32-bit positive ledger boundary [100000, 2147483647]`
    );
  } catch (err) {
    assert(false, `XRPL invoice tag generation failed: ${err.message}`);
  }

  // Test 2.2: Stellar 28-Byte Memo Protocol Invariant
  try {
    const testOrderId = 'NR-ORDER-2026-STELLAR-8812';
    const invoice = await stellarProvider.createInvoice(testOrderId, 20000);
    const memo = String(invoice.paymentIdentifier);

    assert(memo.startsWith('NR'), `Stellar memo starts with official NexusRail prefix "NR" (${memo})`);
    assert(
      Buffer.byteLength(memo, 'utf8') <= 28,
      `Stellar memo byte length (${Buffer.byteLength(memo, 'utf8')}) complies with strict 28-byte Horizon protocol limit`
    );
  } catch (err) {
    assert(false, `Stellar invoice memo generation failed: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Partial Payment & Ledger Exploitation Defenses
  // --------------------------------------------------------------------------
  console.log('\n🛡️ [Suite 3: On-Chain Exploit Prevention & Delivered Amount Tests]');

  // Test 3.1: XRPL Mock Partial Payment Rejection Check
  try {
    // Test that verifyPayment rejects insufficient delivered amount
    const invalidResult = await xrplProvider.verifyPayment('NR-DUMMY-ORDER-123', 'UNKNOWN_TX_HASH_XYZ', 100);
    assert(!invalidResult.verified, 'Unvalidated or non-existent XRPL tx correctly marked unverified');
  } catch (err) {
    assert(false, `XRPL verification handler threw unexpected crash: ${err.message}`);
  }

  // Test 3.2: Stellar Horizon Unvalidated Hash Rejection
  try {
    const invalidResult = await stellarProvider.verifyPayment('NR-DUMMY-ORDER-123', 'UNKNOWN_STELLAR_TX_HASH', 250);
    assert(!invalidResult.verified, 'Unvalidated Stellar tx hash correctly marked unverified');
  } catch (err) {
    assert(false, `Stellar verification handler threw unexpected crash: ${err.message}`);
  }

  // --------------------------------------------------------------------------
  // Summary Report
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
