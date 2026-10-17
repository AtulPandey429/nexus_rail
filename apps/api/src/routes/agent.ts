import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { ProductService } from '../services/products.js';
import { AIRouterService } from '../services/ai/aiRouter.js';
import { ProposalLockManager } from '../agent/proposalLock.js';
import { walletService } from '../services/wallet.js';
import { MongoAuditLogger, MongoService, MongoOrderDoc } from '../services/mongo.js';
import { z } from 'zod';
import crypto from 'crypto';

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
    const lower = message.toLowerCase();

    // Intent: Buy / Order product using internal wallet balance
    if (lower.includes('order') || lower.includes('buy')) {
      const products = await ProductService.getActiveProducts();
      const match = products.find(
        (product) => lower.includes(product.sku.toLowerCase()) || lower.includes(product.title.toLowerCase())
      );

      if (!match) {
        return res.status(400).json({
          success: false,
          error: 'Please specify a valid product from the catalog (e.g. PROD-XRP-KIT, PROD-XLM-PASS, PROD-AGENT-PRO).',
        });
      }

      // Check user's live wallet balance
      const balance = await walletService.getBalance(userId);
      const availableUsd = balance.USD || 0;

      if (availableUsd < match.price_cents) {
        return res.status(400).json({
          success: false,
          error: `Insufficient wallet balance. Available: $${(availableUsd / 100).toFixed(2)}, Required: $${(match.price_cents / 100).toFixed(2)}. Please top up via Stripe or Crypto Testnet.`,
        });
      }

      const proposal = await ProposalLockManager.createProposal(userId, 'PURCHASE_ORDER', {
        sku: match.sku,
        title: match.title,
        priceCents: match.price_cents,
        paymentRail: 'WALLET',
      });

      return res.json({
        success: true,
        reply: `Confirm purchase of ${match.title} (${match.sku}) for $${(match.price_cents / 100).toFixed(2)} USD from your internal wallet balance.`,
        proposal,
      });
    }

    // Standard Assistant Chat Flow
    let aiReply = 'I am the NexusRail Assistant. You can ask about our catalog, check live crypto rates, or buy products using your wallet balance.';
    let latencyMs = 120;

    try {
      const aiRes = await AIRouterService.chatCompletion([
        { role: 'system', content: 'You are the NexusRail commerce assistant. Do not invent mock prices, orders, or fake transaction hashes.' },
        { role: 'user', content: message },
      ]);
      aiReply = aiRes.reply;
      latencyMs = aiRes.latencyMs;
    } catch {
      // Graceful fallback if Groq key is expired/invalid
      if (lower.includes('catalog') || lower.includes('product')) {
        const catalog = await ProductService.getActiveProducts();
        aiReply = `Available in catalog: ${catalog.map((p) => `${p.title} ($${(p.price_cents / 100).toFixed(2)})`).join(', ')}`;
      }
    }

    // Asynchronously log AI trace to MongoDB Atlas
    MongoAuditLogger.logAgentTrace({
      userId,
      sessionId: `sess_${userId}`,
      prompt: message,
      response: aiReply,
      latencyMs,
    }).catch(console.error);

    res.json({
      success: true,
      reply: aiReply,
      latencyMs,
    });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message || 'The assistant failed' });
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

    const proposal = await ProposalLockManager.consumeProposal(proposalId, userId);
    const priceCents = Number(proposal.payload?.priceCents);
    const sku = String(proposal.payload?.sku || '');

    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      return res.status(400).json({ success: false, error: 'Proposal has no valid price' });
    }

    // Atomic debit from user's internal wallet
    const tx = await walletService.debitBalance(userId, priceCents, 'USD', proposal.id);

    // Create a fulfilled order in MongoDB orders collection
    const product = await ProductService.getProductBySku(sku);
    const orderId = crypto.randomUUID();
    const orderNumber = `NR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const now = new Date().toISOString();

    const orderDoc: MongoOrderDoc = {
      id: orderId,
      user_id: userId,
      order_number: orderNumber,
      total_cents: priceCents,
      items: [
        {
          sku,
          title: product?.title || sku,
          qty: 1,
          unit_price_cents: priceCents,
        },
      ],
      payment_rail: 'WALLET',
      status: 'PAID',
      created_at: now,
      updated_at: now,
    };

    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    await ordersCol.insertOne(orderDoc as any);

    res.json({
      success: true,
      message: 'Proposal authorized and executed successfully!',
      order: orderDoc,
      transaction: tx,
    });
  } catch (error: any) {
    res.status(409).json({ success: false, error: error.message || 'Proposal confirmation failed' });
  }
});
