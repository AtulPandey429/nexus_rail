import crypto from 'crypto';

export interface ActionProposal {
  proposalId: string;
  userId: string;
  action: 'PURCHASE_ORDER' | 'DEPOSIT_FUNDS';
  payload: Record<string, any>;
  status: 'PROPOSED' | 'CONFIRMED' | 'EXPIRED';
  expiresAt: number;
}

const proposalStore = new Map<string, ActionProposal>();

export class ProposalLockManager {
  static createProposal(userId: string, action: 'PURCHASE_ORDER' | 'DEPOSIT_FUNDS', payload: Record<string, any>, ttlSeconds: number = 300): ActionProposal {
    const proposalId = `prop_${crypto.randomBytes(6).toString('hex')}`;
    const proposal: ActionProposal = {
      proposalId,
      userId,
      action,
      payload,
      status: 'PROPOSED',
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    proposalStore.set(proposalId, proposal);
    return proposal;
  }

  static getProposal(proposalId: string): ActionProposal | null {
    const proposal = proposalStore.get(proposalId);
    if (!proposal) return null;
    if (proposal.expiresAt < Date.now()) {
      proposal.status = 'EXPIRED';
      proposalStore.delete(proposalId);
      return null;
    }
    return proposal;
  }

  static consumeProposal(proposalId: string, userId: string): ActionProposal {
    const proposal = this.getProposal(proposalId);
    if (!proposal) {
      throw new Error('Proposal lock not found or expired');
    }
    if (proposal.userId !== userId) {
      throw new Error('Unauthorized proposal lock ownership');
    }
    if (proposal.status !== 'PROPOSED') {
      throw new Error(`Proposal already consumed or invalid state (${proposal.status})`);
    }

    proposal.status = 'CONFIRMED';
    proposalStore.delete(proposalId); // Atomic single-use consumption
    return proposal;
  }
}
