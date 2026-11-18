import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { AgentToolRegistry } from '../src/agent/toolRegistry.js';
import { ProposalLockManager } from '../src/agent/proposalLock.js';
import { MongoService } from '../src/services/mongo.js';

describe('Phase 3 (M5): AI Agent Desk 2.0 — Native Tool Calling, Swaps & Custom Baskets', () => {
  const runId = crypto.randomBytes(4).toString('hex');
  const testUserId = `usr_m5_test_${runId}`;
  const createdProposalIds: string[] = [];

  after(async () => {
    try {
      const proposalsCol = await MongoService.getCollection('proposals');
      if (createdProposalIds.length > 0) {
        await proposalsCol.deleteMany({ id: { $in: createdProposalIds } });
      }
      await MongoService.close();
    } catch {
      // quiet cleanup
    }
  });

  it('exposes valid Groq/OpenAI function schemas for all 6 registered tools', () => {
    const tools = AgentToolRegistry.getToolDefinitions();
    assert.strictEqual(tools.length, 6);
    for (const tool of tools) {
      assert.strictEqual(tool.type, 'function');
      assert.ok(tool.function.name.length > 0);
      assert.ok(tool.function.description.length > 10);
      assert.strictEqual((tool.function.parameters as any).type, 'object');
    }
  });

  it('creates a single-use SWAP_ASSETS proposal lock and rejects replay on second consume', async () => {
    const swap = await AgentToolRegistry.createSwapProposal({
      userId: testUserId,
      fromAsset: 'USD',
      toAsset: 'NXL',
      amount: 25,
    });
    createdProposalIds.push(swap.proposal.proposalId);

    assert.strictEqual(swap.proposal.action, 'SWAP_ASSETS');
    assert.ok(swap.quote.receiveAmount > 0);

    // First consumption succeeds
    const consumed = await ProposalLockManager.consumeProposal(swap.proposal.proposalId, testUserId);
    assert.strictEqual(consumed.action, 'SWAP_ASSETS');

    // Second consumption must be rejected (replay protection)
    await assert.rejects(
      () => ProposalLockManager.consumeProposal(swap.proposal.proposalId, testUserId),
      /already used/i
    );
  });

  it('validates custom AI basket ceiling ($10-$5000) and builds live conservative allocations', async () => {
    await assert.rejects(
      () =>
        AgentToolRegistry.createCustomBasketProposal({
          userId: testUserId,
          budgetUsd: 9000,
          riskProfile: 'conservative',
        }),
      /between \$10 and \$5000/i
    );

    const basket = await AgentToolRegistry.createCustomBasketProposal({
      userId: testUserId,
      budgetUsd: 100,
      riskProfile: 'conservative',
    });
    createdProposalIds.push(basket.proposal.proposalId);

    assert.strictEqual(basket.proposal.action, 'CREATE_CUSTOM_BASKET');
    assert.strictEqual(basket.proposal.priceCents, 10000);
    assert.strictEqual(basket.proposal.allocations.length, 3);
    const totalWeight = basket.proposal.allocations.reduce((s, a) => s + a.weightPercent, 0);
    assert.strictEqual(totalWeight, 100);
    assert.strictEqual(basket.proposal.allocations[0].symbol, 'GOLD_G');
  });

  it('issues verified AGENT15 coupon and returns real live portfolio/balance (zero static mock)', async () => {
    const couponTool = await AgentToolRegistry.executeTool('negotiate_discount_coupon', {}, testUserId);
    assert.strictEqual(couponTool.success, true);
    assert.strictEqual((couponTool.result as any).code, 'AGENT15');
    assert.strictEqual((couponTool.result as any).discountPercent, 15);

    const balTool = await AgentToolRegistry.executeTool('get_portfolio_and_balance', {}, testUserId);
    assert.strictEqual(balTool.success, true);
    // Fresh test user must genuinely have 0 USD and 0 NXL (not hardcoded 45.0 NR mock)
    assert.strictEqual((balTool.result as any).usdBalance, 0);
    assert.strictEqual((balTool.result as any).nxlBalance, 0);
  });
});
