import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AIRouterService } from '../services/ai/aiRouter.js';
import { ProposalLockManager } from '../agent/proposalLock.js';
import { walletService } from '../services/wallet.js';
import { z } from 'zod';

export const agentRouter = Router();

const AgentChatSchema = z.object({
  message: z.string().min(1),
});

const ConfirmProposalSchema = z.object({
  proposalId: z.string(),
});

// POST /api/v1/agent/chat - High-speed AI chat streaming & proposal generation
agentRouter.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = AgentChatSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid chat message' });
    }

    const { message } = parseResult.data;
    const userId = req.user!.id;

    // Check if user is requesting a purchase action
    if (message.toLowerCase().includes('order') || message.toLowerCase().includes('buy')) {
      const proposal = ProposalLockManager.createProposal(userId, 'PURCHASE_ORDER', {
        sku: 'PROD-XRP-KIT',
        title: 'XRPL Starter Validator Node Hardware',
        priceCents: 49900,
        paymentRail: 'XRPL',
      });

      return res.json({
        success: true,
        reply: 'I have generated a purchase proposal card for the XRPL Starter Kit. Please confirm below to execute your order.',
        proposal,
      });
    }

    const aiRes = await AIRouterService.chatCompletion([
      { role: 'system', content: 'You are NexusRail AI Agent Desk assistant.' },
      { role: 'user', content: message },
    ]);

    res.json({
      success: true,
      reply: aiRes.reply,
      modelUsed: aiRes.modelUsed,
      latencyMs: aiRes.latencyMs,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'AI Agent Desk processing failed' });
  }
});

// POST /api/v1/agent/confirm - Human authorization execution of proposal lock
agentRouter.post('/confirm', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = ConfirmProposalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid proposal confirmation payload' });
    }

    const { proposalId } = parseResult.data;
    const userId = req.user!.id;

    // Atomically consume proposal lock
    const proposal = ProposalLockManager.consumeProposal(proposalId, userId);
    
    // Execute backend wallet debit/order fulfillment
    const tx = await walletService.debitBalance(userId, proposal.payload.priceCents || 49900, 'USD', proposal.proposalId);

    res.json({
      success: true,
      message: 'Proposal authorized and executed successfully!',
      proposal,
      transaction: tx,
    });
  } catch (error: any) {
    res.status(409).json({ success: false, error: error.message || 'Proposal confirmation failed' });
  }
});
