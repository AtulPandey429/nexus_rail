import crypto from 'crypto';
import type { ClientSession } from 'mongodb';
import { MongoService, MongoProposalDoc } from '../services/mongo.js';

export class ProposalLockManager {
  static async createProposal(
    userId: string,
    action: 'PURCHASE_ORDER' | 'DEPOSIT_FUNDS' | 'PAY_ORDER',
    payload: Record<string, unknown>
  ) {
    const proposalId = `prop_${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL
    const now = new Date().toISOString();

    const proposalDoc: MongoProposalDoc = {
      id: proposalId,
      user_id: userId,
      action,
      payload,
      status: 'PROPOSED',
      expiresAt,
      created_at: now,
    };

    const col = await MongoService.getCollection<MongoProposalDoc>('proposals');
    await col.insertOne(proposalDoc as any);

    return {
      proposalId: proposalDoc.id,
      userId: proposalDoc.user_id,
      action: proposalDoc.action,
      payload: proposalDoc.payload,
      status: proposalDoc.status,
      expiresAt: proposalDoc.expiresAt.toISOString(),
    };
  }

  static async rejectProposal(proposalId: string, userId: string): Promise<MongoProposalDoc> {
    const col = await MongoService.getCollection<MongoProposalDoc>('proposals');

    const result: any = await col.findOneAndUpdate(
      {
        id: proposalId,
        user_id: userId,
        status: 'PROPOSED',
      },
      {
        $set: { status: 'REJECTED', rejected_at: new Date().toISOString() },
      },
      { returnDocument: 'after' }
    );

    const updated = result?.value || result;
    if (!updated || !updated.id) {
      const existing = await col.findOne({ id: proposalId });
      if (!existing) throw new Error('Proposal was not found');
      if (existing.user_id !== userId) throw new Error('This proposal belongs to another account');
      if (existing.status !== 'PROPOSED') throw new Error(`Proposal was already ${existing.status.toLowerCase()}`);
      throw new Error('Proposal could not be rejected');
    }

    return updated as MongoProposalDoc;
  }

  static async consumeProposal(proposalId: string, userId: string, session?: ClientSession): Promise<MongoProposalDoc> {
    const col = await MongoService.getCollection<MongoProposalDoc>('proposals');

    const updateOptions: any = { returnDocument: 'before' };
    if (session) updateOptions.session = session;

    // Atomically find, validate expiry, and update status
    const result: any = await col.findOneAndUpdate(
      {
        id: proposalId,
        user_id: userId,
        status: 'PROPOSED',
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { status: 'CONFIRMED' },
      },
      updateOptions
    );

    const updated = result?.value || result;

    if (!updated || !updated.id) {
      // Check if it existed but was expired or already used
      const existing = await col.findOne({ id: proposalId });
      if (!existing) throw new Error('Proposal was not found');
      if (existing.user_id !== userId) throw new Error('This proposal belongs to another account');
      if (existing.status !== 'PROPOSED') throw new Error('Proposal was already used');
      if (existing.expiresAt.getTime() <= Date.now()) throw new Error('Proposal expired');
      throw new Error('Proposal could not be consumed');
    }

    return updated as MongoProposalDoc;
  }
}
