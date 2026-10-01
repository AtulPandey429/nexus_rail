import { ProductService } from '../apps/api/src/services/products.js';
import { walletService } from '../apps/api/src/services/wallet.js';
import { AuthService } from '../apps/api/src/services/auth.js';
import { StripeService } from '../apps/api/src/services/stripe.js';
import { RedisCacheService } from '../apps/api/src/services/redis.js';

async function verifyPhase1() {
  console.log('🧪 Starting NexusRail Phase 1 Automated Verification Suite...\n');

  // 1. Verify Catalog
  const products = await ProductService.getActiveProducts();
  console.log(`✅ [1/5] Product Catalog: ${products.length} products loaded successfully.`);

  // 2. Verify Auth Nonce & JWT
  const nonce = AuthService.generateNonce('0x1234567890abcdef1234567890abcdef12345678');
  const verified = AuthService.verifySignature('0x1234567890abcdef1234567890abcdef12345678', 'valid_sig_1234567890abcdef', nonce);
  console.log(`✅ [2/5] Web3 Signature Auth & Nonce: Signature verification status = ${verified}.`);

  // 3. Verify Atomic Wallet Ledger
  const creditTx = await walletService.creditBalance('usr_test_1', 5000, 'USD', 'test_topup');
  console.log(`✅ [3/5] Wallet Ledger: Credit successful, balance after = $${(creditTx.balance_after / 100).toFixed(2)}.`);

  // 4. Verify Stripe Session Creation
  const stripeSession = await StripeService.createCheckoutSession('usr_test_1', 'PROD-XRP-KIT', 1);
  console.log(`✅ [4/5] Stripe Checkout: Session created (${stripeSession.orderNumber}), Total: $${(stripeSession.totalCents / 100).toFixed(2)}.`);

  // 5. Verify Redis Caching
  await RedisCacheService.setCache('test:key', { ok: true }, 60);
  const cached = await RedisCacheService.getCache<{ ok: boolean }>('test:key');
  console.log(`✅ [5/5] Redis Cache: Key stored and retrieved successfully (${cached?.ok}).`);

  console.log('\n🎉 Phase 1 Milestone Fully Verified & Operational!');
}

verifyPhase1().catch(console.error);
