import dotenv from 'dotenv';
dotenv.config({ path: 'd:/live/nexus-rail/.env' });

import { MongoService } from '../apps/api/dist/services/mongo.js';
import { AuthService } from '../apps/api/dist/services/auth.js';
import { verifyToken } from '../apps/api/dist/services/jwt.js';

async function testPhase1Auth() {
  console.log('🚀 [Phase 1 Verification] Starting MongoDB Primary Engine & Auth Test Suite...\n');

  try {
    // 1. Verify MongoDB Connection
    console.log('🍃 [1/6] Connecting to MongoDB Atlas...');
    const db = await MongoService.getDb();
    console.log(`   ✅ Connected to database: "${db.databaseName}"`);

    // 2. Test User Registration
    const testEmail = `fintech_tester_${Date.now()}@nexusrail.io`;
    const testPassword = 'SecurePassword2026!';
    console.log(`\n👤 [2/6] Testing Registration for: ${testEmail}...`);
    const regResult = await AuthService.register(testEmail, testPassword);
    console.log(`   ✅ User Registered! User ID: ${regResult.user.id}, Role: ${regResult.user.role}`);
    console.log(`   ✅ JWT Token Issued: ${regResult.token.substring(0, 32)}...`);

    // 3. Test Duplicate Registration Prevention
    console.log('\n🚫 [3/6] Testing Duplicate Registration Prevention...');
    let duplicateRejected = false;
    try {
      await AuthService.register(testEmail, testPassword);
    } catch (err) {
      duplicateRejected = true;
      console.log(`   ✅ Duplicate correctly rejected with: "${err.message}"`);
    }
    if (!duplicateRejected) throw new Error('Duplicate registration should have failed!');

    // 4. Test User Login (Valid Password)
    console.log('\n🔐 [4/6] Testing User Login with Valid Password...');
    const loginResult = await AuthService.login(testEmail, testPassword);
    console.log(`   ✅ Login Successful! User ID: ${loginResult.user.id}`);
    
    // Verify token validity
    const verifiedUser = verifyToken(loginResult.token);
    console.log(`   ✅ JWT Signature Verified! Sub/ID: ${verifiedUser.id}, Email: ${verifiedUser.email}`);

    // Verify fetching user from MongoDB via getUserById
    const fetchedUser = await AuthService.getUserById(loginResult.user.id);
    console.log(`   ✅ User Fetched from MongoDB: ${fetchedUser?.email} (${fetchedUser?.role})`);

    // 5. Test User Login (Invalid Password)
    console.log('\n❌ [5/6] Testing User Login with Invalid Password...');
    let badPasswordRejected = false;
    try {
      await AuthService.login(testEmail, 'WrongPassword123!');
    } catch (err) {
      badPasswordRejected = true;
      console.log(`   ✅ Bad password correctly rejected with: "${err.message}"`);
    }
    if (!badPasswordRejected) throw new Error('Bad password login should have failed!');

    // 6. Test Web3 Nonce Creation in MongoDB
    const testWallet = '0x1111222233334444555566667777888899990000';
    console.log(`\n💳 [6/6] Testing Web3 Nonce Generation for: ${testWallet}...`);
    const nonce = await AuthService.createNonce(testWallet);
    console.log(`   ✅ Nonce generated & stored in MongoDB: "${nonce.replace(/\n/g, ' ')}"`);

    // Cleanup test user and nonce
    const usersCol = await MongoService.getCollection('users');
    await usersCol.deleteOne({ id: regResult.user.id });
    const noncesCol = await MongoService.getCollection('auth_nonces');
    await noncesCol.deleteOne({ walletAddress: testWallet.toLowerCase() });
    console.log(`\n🧹 [Cleanup] Deleted test user ${regResult.user.id} and test nonce from MongoDB.`);

    console.log('\n🎉 [PHASE 1 COMPLETE] All 6/6 MongoDB Primary & Auth Tests Verified 100%!');
  } catch (error) {
    console.error('\n❌ [Phase 1 Error]:', error.message);
    process.exit(1);
  } finally {
    await MongoService.close();
  }
}

testPhase1Auth().catch(console.error);
