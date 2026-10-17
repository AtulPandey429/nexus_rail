import dotenv from 'dotenv';
dotenv.config({ path: 'd:/live/nexus-rail/.env' });

import { MongoService } from '../apps/api/dist/services/mongo.js';
import { AuthService } from '../apps/api/dist/services/auth.js';
import { walletService } from '../apps/api/dist/services/wallet.js';
import { ProposalLockManager } from '../apps/api/dist/agent/proposalLock.js';

async function testPhase5LedgerAndAgent() {
  console.log('🚀 [Phase 5 Verification] Starting Wallet Ledger & AI Agent Proposal Test Suite...\n');

  try {
    // 1. Create a clean test user
    const testEmail = `fintech_agent_${Date.now()}@nexusrail.io`;
    const reg = await AuthService.register(testEmail, 'StrongPass2026!');
    const userId = reg.user.id;
    console.log(`👤 [1/6] Registered Test Trader: ${testEmail} (ID: ${userId})`);

    // 2. Verify Initial Balance
    console.log('\n💰 [2/6] Verifying Initial Multi-Asset Wallet Balances...');
    const initBalance = await walletService.getBalance(userId);
    console.log(`   ✅ Initial Balances: USD: $${(initBalance.USD / 100).toFixed(2)}, XRP: ${initBalance.XRP}, XLM: ${initBalance.XLM}`);
    if (initBalance.USD !== 0) throw new Error('Initial balance should be 0');

    // 3. Credit $100.00 USD to Internal Wallet
    console.log('\n💵 [3/6] Crediting $100.00 USD Deposit to Wallet...');
    const creditTx = await walletService.creditBalance(userId, 10000, 'USD', 'test_deposit_stripe');
    console.log(`   ✅ Deposit Recorded! TxID: ${creditTx.id}`);
    console.log(`   ✅ Balance After: $${(creditTx.balance_after / 100).toFixed(2)} USD`);

    // 4. Test Insufficient Balance Safety
    console.log('\n🛡️ [4/6] Testing Insufficient Balance Protection...');
    let debitRejected = false;
    try {
      await walletService.debitBalance(userId, 25000, 'USD', 'overdraft_attempt');
    } catch (err) {
      debitRejected = true;
      console.log(`   ✅ Overdraft correctly prevented with: "${err.message}"`);
    }
    if (!debitRejected) throw new Error('Overdraft should have failed!');

    // 5. Test AI Proposal Lock Creation
    console.log('\n🤖 [5/6] Testing AI Proposal Lock (Propose -> Confirm -> Act)...');
    const proposal = await ProposalLockManager.createProposal(userId, 'PURCHASE_ORDER', {
      sku: 'PROD-AGENT-PRO',
      title: 'NexusRail AI Agent Desk Pro Key',
      priceCents: 2990,
      paymentRail: 'WALLET',
    });
    console.log(`   ✅ Proposal Generated: ${proposal.proposalId} (Status: ${proposal.status})`);
    console.log(`   ✅ Action: ${proposal.action} | Price: $${(proposal.payload.priceCents / 100).toFixed(2)}`);
    console.log(`   ✅ Single-Use TTL Expiry: ${proposal.expiresAt}`);

    // 6. Test Proposal Confirmation & Atomic Debit
    console.log('\n⚡ [6/6] Confirming and Executing Proposal Atomically...');
    const consumed = await ProposalLockManager.consumeProposal(proposal.proposalId, userId);
    console.log(`   ✅ Proposal Consumed: ${consumed.id}`);

    const debitTx = await walletService.debitBalance(userId, proposal.payload.priceCents, 'USD', proposal.proposalId);
    console.log(`   ✅ Purchase Debited! TxID: ${debitTx.id}`);
    console.log(`   ✅ Final Balance After Purchase: $${(debitTx.balance_after / 100).toFixed(2)} USD`);
    if (debitTx.balance_after !== 7010) { // $100.00 - $29.90 = $70.10 (7010 cents)
      throw new Error(`Expected balance 7010, got ${debitTx.balance_after}`);
    }

    // Verify Replay Attack Prevention
    let replayBlocked = false;
    try {
      await ProposalLockManager.consumeProposal(proposal.proposalId, userId);
    } catch (err) {
      replayBlocked = true;
      console.log(`   ✅ Replay attack correctly blocked with: "${err.message}"`);
    }
    if (!replayBlocked) throw new Error('Replay proposal consumption should have failed!');

    // Cleanup
    console.log('\n🧹 [Cleanup] Cleaning up test user and ledger entries...');
    await (await MongoService.getCollection('users')).deleteOne({ id: userId });
    await (await MongoService.getCollection('wallet_ledger')).deleteMany({ user_id: userId });
    await (await MongoService.getCollection('proposals')).deleteOne({ id: proposal.proposalId });
    console.log('   ✅ Cleaned up successfully.');

    console.log('\n🎉 [PHASE 5 COMPLETE] Double-Entry Ledger & AI Proposal Engine Verified 100% on MongoDB!');
  } catch (error) {
    console.error('\n❌ [Phase 5 Error]:', error.message);
    process.exit(1);
  } finally {
    await MongoService.close();
  }
}

testPhase5LedgerAndAgent().catch(console.error);
