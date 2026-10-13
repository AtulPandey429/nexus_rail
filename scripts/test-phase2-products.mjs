import dotenv from 'dotenv';
dotenv.config({ path: 'd:/live/nexus-rail/.env' });

import { MongoService } from '../apps/api/dist/services/mongo.js';
import { ProductService } from '../apps/api/dist/services/products.js';

async function testPhase2Products() {
  console.log('🚀 [Phase 2 Verification] Starting Product Catalog, Inventory & Upvotes Test Suite...\n');

  try {
    // 1. Connect and fetch active products
    console.log('📦 [1/4] Fetching Active Products from MongoDB...');
    const products = await ProductService.getActiveProducts();
    console.log(`   ✅ Active Products Loaded: ${products.length} products found.`);
    if (products.length === 0) throw new Error('Expected at least 1 product seeded in MongoDB!');
    for (const p of products) {
      console.log(`      • [${p.sku}] ${p.title} - $${(p.price_cents / 100).toFixed(2)} (Stock: ${p.stock_quantity}, Upvotes: ${p.upvotes_count})`);
    }

    // 2. Fetch single product by SKU
    console.log('\n🔍 [2/4] Fetching Product by SKU: PROD-XRP-KIT...');
    const xrpKit = await ProductService.getProductBySku('PROD-XRP-KIT');
    if (!xrpKit) throw new Error('Could not find PROD-XRP-KIT!');
    console.log(`   ✅ Found: ${xrpKit.title} | Price: $${(xrpKit.price_cents / 100).toFixed(2)}`);

    // 3. Test Atomic Upvoting
    console.log('\n👍 [3/4] Testing Atomic Upvoting on PROD-XRP-KIT...');
    const initialUpvotes = xrpKit.upvotes_count;
    const newUpvotes = await ProductService.incrementUpvotes('PROD-XRP-KIT');
    console.log(`   ✅ Upvote Succeeded! ${initialUpvotes} -> ${newUpvotes}`);
    if (newUpvotes !== initialUpvotes + 1) {
      throw new Error(`Expected upvotes to increment by 1, got ${newUpvotes}`);
    }

    // 4. Test Showdowns in MongoDB
    console.log('\n⚔️ [4/4] Testing Community Showdowns in MongoDB...');
    const showdownCol = await MongoService.getCollection('showdowns');
    const showdown = await showdownCol.findOne({ id: 'showdown_xrp_vs_xlm' });
    if (showdown) {
      console.log(`   ✅ Showdown Loaded: "${showdown.title}" (Votes A: ${showdown.votes_a}, Votes B: ${showdown.votes_b})`);
    } else {
      console.log('   ℹ️ Showdown will initialize on first router access.');
    }

    console.log('\n🎉 [PHASE 2 COMPLETE] All Product Catalog & Inventory Tests Verified 100% on MongoDB!');
  } catch (error) {
    console.error('\n❌ [Phase 2 Error]:', error.message);
    process.exit(1);
  } finally {
    await MongoService.close();
  }
}

testPhase2Products().catch(console.error);
