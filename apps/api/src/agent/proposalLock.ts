import crypto from 'crypto';
import { MongoService, MongoProposalDoc } from '../services/mongo.js';

export class ProposalLockManager {
  static async createProposal(
    userId: string,
    action: 'PURCHASE_ORDER' | 'DEPOSIT_FUNDS',
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

  static async consumeProposal(proposalId: string, userId: string) {
    const col = await MongoService.getCollection<MongoProposalDoc>('proposals');

    // Atomically find, validate expiry, and update status
    const updated = await col.findOneAndUpdate(
      {
        id: proposalId,
        user_id: userId,
        status: 'PROPOSED',
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { status: 'CONFIRMED' },
      },
      { returnDocument: 'before' }
    );

    if (!updated) {
      // Check if it existed but was expired or already used
      const existing = await col.findOne({ id: proposalId });
      if (!existing) throw new Error('Proposal was not found');
      if (existing.user_id !== userId) throw new Error('This proposal belongs to another account');
      if (existing.status !== 'PROPOSED') throw new Error('Proposal was already used');
      if (existing.expiresAt.getTime() <= Date.now()) throw new Error('Proposal expired');
      throw new Error('Proposal could not be consumed');
    }

    return updated;
  }
}
