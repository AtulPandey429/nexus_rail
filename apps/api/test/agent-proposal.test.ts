import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { ProposalLockManager } from '../src/agent/proposalLock.js';
import { MongoService } from '../src/services/mongo.js';

describe('Suite: Agent Proposal Lock & Concurrency Defense', () => {
  const userId = `agent_test_${Date.now()}`;
  let createdProposalId = '';

  after(async () => {
    await MongoService.close();
  });

  test('Creates single-use proposal lock with status PROPOSED and 5-min TTL', async () => {
    const proposal = await ProposalLockManager.createProposal(userId, 'PURCHASE_ORDER', {
      sku: 'RAIL-ONE',
      priceCents: 12900,
    });

    assert.ok(proposal.proposalId.startsWith('prop_'));
    assert.equal(proposal.userId, userId);
    assert.equal(proposal.action, 'PURCHASE_ORDER');
    assert.equal(proposal.status, 'PROPOSED');
    assert.ok(new Date(proposal.expiresAt).getTime() > Date.now());

    createdProposalId = proposal.proposalId;
  });

  test('Consumes proposal atomically on first attempt', async () => {
    const consumed = await ProposalLockManager.consumeProposal(createdProposalId, userId);
    assert.equal(consumed.id, createdProposalId);
    assert.equal(consumed.status, 'PROPOSED');
  });

  test('Strictly rejects replay attempts (second consumption throws already used)', async () => {
    await assert.rejects(
      async () => ProposalLockManager.consumeProposal(createdProposalId, userId),
      /Proposal was already used/
    );
  });

  test('Strictly rejects consumption by a different user ID', async () => {
    const secondProposal = await ProposalLockManager.createProposal(userId, 'PURCHASE_ORDER', {
      sku: 'RELAY-MAT',
      priceCents: 3900,
    });

    await assert.rejects(
      async () => ProposalLockManager.consumeProposal(secondProposal.proposalId, 'different_user_999'),
      /This proposal belongs to another account/
    );
  });
});
