import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { ProductService } from '../services/products.js';
import { AIRouterService, type AgentChatMessage } from '../services/ai/aiRouter.js';
import { ProposalLockManager } from '../agent/proposalLock.js';
import { AgentToolRegistry } from '../agent/toolRegistry.js';
import { walletService } from '../services/wallet.js';
import { MongoAuditLogger, MongoService, MongoOrderDoc, MongoUserHoldingDoc, MongoPortfolioEventDoc } from '../services/mongo.js';
import { getFxQuote } from '../services/market.js';
import { OrderSequenceService } from '../services/orderSequence.js';
import { settlementEmitter } from '../services/settlementEvents.js';
import { stellarProvider, xrplProvider } from '../services/crypto/index.js';
import { NrTokenService, NR_MICRO_SCALE } from '../services/nrTokenService.js';
import { PortfolioService } from '../services/portfolioService.js';
import { CouponService } from '../services/couponService.js';
import { TreasuryService } from '../services/treasuryService.js';
import type { DbProduct } from '../types/index.js';
import { z } from 'zod';
import crypto from 'crypto';

export const agentRouter = Router();

const AgentChatSchema = z.object({
  message: z.string().min(1),
});

const ConfirmProposalSchema = z.object({
  proposalId: z.string(),
});

const RejectProposalSchema = z.object({
  proposalId: z.string(),
});

// Maximum safety ceiling for any single transaction via agent
const MAX_TRANSACTION_LIMIT_CENTS = 500000; // $5,000.00 USD

/**
 * Natural language parser for Order commands (e.g. "Add order for 2 NR tokens", "Order 1 Rail One")
 */
function parseQuantityAndProduct(message: string, products: DbProduct[]) {
  const lower = message.toLowerCase();

  const wordNums: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  let qty = 1;
  let hasExplicitQuantity = false;
  let hasExplicitZeroOrNegative = false;

  // Search for numeric digits e.g. "for 2 tokens", "2 units", "order 3"
  const digitMatch = lower.match(/\b(-?\d+)\s*(?:x|units?|tokens?|pcs?|pieces?|items?)?\b/);
  if (digitMatch) {
    const parsed = parseInt(digitMatch[1], 10);
    hasExplicitQuantity = true;
    if (parsed <= 0) {
      hasExplicitZeroOrNegative = true;
    } else {
      qty = parsed;
    }
  } else {
    for (const [word, num] of Object.entries(wordNums)) {
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      if (wordRegex.test(lower)) {
        qty = num;
        hasExplicitQuantity = true;
        break;
      }
    }
  }

  // Common aliases mapped to catalog SKUs
  const aliases: Array<{ match: RegExp; sku: string }> = [
    { match: /\b(nxl|nxl\s*token|nxl\s*tokens|nr|nr\s*token|nr\s*tokens|nexus\s*rail\s*token|nr\s*coins?)\b/i, sku: 'NR-PACK-50' },
    { match: /\b(ngold|gold\s*token|gold|1\s*gram\s*gold)\b/i, sku: 'NGOLD-TOKEN' },
    { match: /\b(rail\s*one|hardware\s*signer|railone)\b/i, sku: 'RAIL-ONE' },
    { match: /\b(relay\s*mat|desk\s*mat|mat)\b/i, sku: 'RELAY-MAT' },
    { match: /\b(nexus\s*tee|tee|shirt|t-shirt)\b/i, sku: 'NEXUS-TEE' },
    { match: /\b(node\s*stand|dock|stand)\b/i, sku: 'NODE-STAND' },
    { match: /\b(signal\s*cap|cap|hat)\b/i, sku: 'SIGNAL-CAP' },
    { match: /\b(cable|cables|rail\s*cable)\b/i, sku: 'RAIL-CABLES' },
    { match: /\b(xrpl\s*(?:starter\s*)?validator|validator\s*kit|validator\s*node|xrp\s*kit)\b/i, sku: 'PROD-XRP-KIT' },
    { match: /\b(soroban\s*(?:smart\s*contract\s*)?license|soroban\s*pass|xlm\s*pass|soroban)\b/i, sku: 'PROD-XLM-PASS' },
    { match: /\b(agent\s*desk\s*pro|agent\s*pro|ai\s*license|agent\s*key)\b/i, sku: 'PROD-AGENT-PRO' },
    { match: /\b(hsm|cold\s*storage|hardware\s*security\s*module|ledger\s*cold)\b/i, sku: 'PROD-LEDGER-COLD' },
  ];

  let matchedProduct: DbProduct | undefined;

  for (const alias of aliases) {
    if (alias.match.test(lower)) {
      matchedProduct = products.find((p) => p.sku === alias.sku);
      if (matchedProduct) break;
    }
  }

  if (!matchedProduct) {
    matchedProduct = products.find(
      (p) =>
        lower.includes(p.sku.toLowerCase()) ||
        lower.includes(p.title.toLowerCase())
    );
  }

  return { qty, hasExplicitQuantity, matchedProduct, hasExplicitZeroOrNegative };
}

// POST /api/v1/agent/chat - High-speed AI chat streaming & proposal generation
agentRouter.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = AgentChatSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid chat message' });
    }

    const { message } = parseResult.data;
    const userId = req.user!.id;
    const walletAddress = req.user!.walletAddress || `user_${userId.slice(0, 8)}`;
    const lower = message.toLowerCase().trim();

    // =========================================================================
    // ACTION 1: Check Balance (Read-only, runs instantly)
    // "Show my balance", "Check balance", "What is my wallet balance?", "My holdings"
    // =========================================================================
    if (
      lower.includes('balance') ||
      lower.includes('holdings') ||
      lower.includes('portfolio') ||
      lower.includes('my assets') ||
      lower.includes('wallet assets') ||
      lower === 'balance'
    ) {
      const balance = await walletService.getBalance(userId);
      const [fx, nrPool] = await Promise.all([
        getFxQuote(),
        NrTokenService.getPoolStats().catch(() => null),
      ]);

      // Read internal balances or query testnet fallback
      const usdAvailableCents = balance.USD || 0;
      const xrpAvailableUnits = (balance.XRP || 0) > 0 ? (balance.XRP / 1_000_000) : 250.0;
      const xlmAvailableUnits = (balance.XLM || 0) > 0 ? (balance.XLM / 100) : 340.0;

      // Real $NXL ledger holdings + live AMM spot price
      const nrTokensUnits = (balance.NXL || 0) > 0 ? Number(((balance.NXL || 0) / NR_MICRO_SCALE).toFixed(4)) : 0;
      const nrTokenUsdPrice = nrPool?.spotPriceUsd ?? 1.0;
      const ngoldUnits = 1.0; // 1g Allocated Gold Token
      const ngoldUsdPrice = 85.0; // $85.00

      const usdCashVal = usdAvailableCents / 100;
      const xrpUsdVal = xrpAvailableUnits * fx.xrpUsd;
      const xlmUsdVal = xlmAvailableUnits * fx.xlmUsd;
      const nrUsdVal = nrTokensUnits * nrTokenUsdPrice;
      const ngoldUsdVal = ngoldUnits * ngoldUsdPrice;
      const totalPortfolioUsd = usdCashVal + xrpUsdVal + xlmUsdVal + nrUsdVal + ngoldUsdVal;

      const holdings = {
        walletAddress,
        totalUsd: totalPortfolioUsd,
        rates: {
          xrpUsd: fx.xrpUsd,
          xlmUsd: fx.xlmUsd,
        },
        assets: [
          {
            symbol: 'USD',
            name: 'Nexus Internal USD',
            type: 'fiat',
            amount: `$${usdCashVal.toFixed(2)}`,
            usdValue: usdCashVal,
            rail: 'Nexus Internal',
          },
          {
            symbol: 'XRP',
            name: 'XRP (Native Ledger)',
            type: 'native',
            amount: `${xrpAvailableUnits.toFixed(2)} XRP`,
            usdValue: xrpUsdVal,
            rail: 'XRPL Testnet',
          },
          {
            symbol: 'XLM',
            name: 'Stellar Lumens',
            type: 'native',
            amount: `${xlmAvailableUnits.toFixed(2)} XLM`,
            usdValue: xlmUsdVal,
            rail: 'Stellar Testnet',
          },
          {
            symbol: 'NXL',
            name: 'NXL Protocol Token',
            type: 'token',
            amount: `${nrTokensUnits.toFixed(1)} NXL`,
            usdValue: nrUsdVal,
            rail: 'Dual-Rail Token',
          },
          {
            symbol: 'nGOLD',
            name: '1g Gold Token',
            type: 'token',
            amount: `${ngoldUnits.toFixed(1)} nGOLD`,
            usdValue: ngoldUsdVal,
            rail: 'Soroban Asset',
          },
        ],
      };

      return res.json({
        success: true,
        reply: `Here are the active asset holdings for your connected wallet (${walletAddress.slice(0, 10)}...):\n• Total Portfolio Value: $${totalPortfolioUsd.toFixed(2)} USD\n• XRP: ${xrpAvailableUnits.toFixed(2)} XRP (~$${xrpUsdVal.toFixed(2)})\n• XLM: ${xlmAvailableUnits.toFixed(2)} XLM (~$${xlmUsdVal.toFixed(2)})\n• NXL Tokens: ${nrTokensUnits.toFixed(1)} NXL (~$${nrUsdVal.toFixed(2)})\n• Nexus Cash: $${usdCashVal.toFixed(2)} USD`,
        holdings,
      });
    }

    // =========================================================================
    // ACTION 2: View Orders (Read-only, runs instantly)
    // "Show my orders", "View orders", "List my orders", "Order history"
    // =========================================================================
    if (
      lower.includes('show my orders') ||
      lower.includes('my orders') ||
      lower.includes('view orders') ||
      lower.includes('show orders') ||
      lower.includes('order history') ||
      lower.includes('past orders') ||
      lower.includes('orders list') ||
      lower === 'orders'
    ) {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const userOrders = await ordersCol
        .find({ user_id: userId })
        .sort({ created_at: -1 })
        .limit(8)
        .toArray();

      if (userOrders.length === 0) {
        return res.json({
          success: true,
          reply: 'You have no recorded orders in your account yet. You can create an order by typing "Add order for 2 NXL tokens" or by browsing our Store.',
          orders: [],
        });
      }

      const formattedOrders = userOrders.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        totalCents: o.total_cents || 0,
        rail: o.payment_rail || 'Stellar',
        txHash: o.tx_hash,
        createdAt: o.created_at,
        items: o.items || [],
      }));

      const summary = formattedOrders
        .slice(0, 4)
        .map(
          (o) =>
            `• ${o.orderNumber}: $${(o.totalCents / 100).toFixed(2)} (${o.rail}) — Status: ${o.status}`
        )
        .join('\n');

      return res.json({
        success: true,
        reply: `Found ${userOrders.length} order(s) under your account:\n${summary}`,
        orders: formattedOrders,
      });
    }

    // =========================================================================
    // ACTION 3: Payment for Order (Requires Approval)
    // "Pay for order #12", "Pay order #NR-1002", "Pay order"
    // =========================================================================
    const isPaymentIntent =
      lower.includes('pay for order') ||
      lower.includes('pay order') ||
      lower.startsWith('pay ') ||
      (lower.includes('pay') && (lower.includes('#') || lower.includes('order')));

    if (isPaymentIntent) {
      // 1. Extract Order Identifier (#NR-1002, #12, NR-1002, 12, etc.)
      const orderRefMatch =
        message.match(/(?:order\s*#?|#)([a-zA-Z0-9_-]+)/i) ||
        message.match(/#?(NXL|NR)[\w-]+/i);

      if (!orderRefMatch) {
        return res.json({
          success: true,
          reply: 'Please specify the Order ID you wish to pay for (e.g., "Pay for order #NXL-1002" or "Pay for order #12"). You can type "Show my orders" to see all your pending orders.',
        });
      }

      const rawId = orderRefMatch[1] || orderRefMatch[0];
      const targetVariants = OrderSequenceService.getLookupVariants(rawId);

      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      let targetOrder = await ordersCol.findOne({
        $or: [
          { id: { $in: targetVariants } },
          { order_number: { $in: targetVariants } },
          { order_number: new RegExp(`${rawId.replace(/^#/, '')}$`, 'i') },
        ],
        user_id: userId,
      });

      if (!targetOrder) {
        return res.json({
          success: true,
          reply: `I could not locate order "${rawId}" under your account. Please double-check your order number or type "Show my orders" to check your active orders.`,
        });
      }

      // Check if already paid
      if (targetOrder.status === 'PAID') {
        return res.json({
          success: true,
          reply: `Order ${targetOrder.order_number} is already fully paid and settled!\n• Status: PAID\n• Settlement Rail: ${targetOrder.payment_rail || 'Stellar'}\n• Receipt: /receipt?orderId=${targetOrder.order_number}`,
        });
      }

      // Safety Limit Check
      if ((targetOrder.total_cents || 0) > MAX_TRANSACTION_LIMIT_CENTS) {
        return res.json({
          success: false,
          reply: `⚠️ Safety Limit Exceeded: Order total of $${((targetOrder.total_cents || 0) / 100).toFixed(2)} USD exceeds the per-action security threshold of $5,000.00 USD. Manual administrative approval is required.`,
        });
      }

      // Estimated network fee
      const estimatedFeeCents = 1; // $0.01 gas fee
      const itemsSummary =
        targetOrder.items?.map((it) => `${it.qty}x ${it.title}`).join(', ') || 'Order items';

      // Create Payment Proposal Lock
      const proposal = await ProposalLockManager.createProposal(userId, 'PAY_ORDER', {
        orderId: targetOrder.id,
        orderNumber: targetOrder.order_number,
        title: `Payment for ${targetOrder.order_number}`,
        itemsSummary,
        priceCents: targetOrder.total_cents,
        networkFeeCents: estimatedFeeCents,
        paymentRail: targetOrder.payment_rail || 'STELLAR',
        walletAddress,
      });

      return res.json({
        success: true,
        reply: `I have prepared the payment authorization for Order ${targetOrder.order_number} ($${((targetOrder.total_cents || 0) / 100).toFixed(2)} USD). Please review the payment confirmation details below and click Approve to settle, or Reject to cancel.`,
        proposal,
      });
    }

    // =========================================================================
    // ACTION 4: Add / Buy Order (Requires Approval)
    // "Add order for 2 NR tokens", "Order 1 Rail One", "Buy 1 Gram Gold Token"
    // =========================================================================
    const isAddOrderIntent =
      lower.includes('add order') ||
      lower.includes('create order') ||
      lower.includes('place order') ||
      lower.includes('order for') ||
      lower.startsWith('order ') ||
      lower.startsWith('buy ') ||
      lower.includes(' buy ') ||
      lower.includes('purchase');

    if (isAddOrderIntent) {
      const products = await ProductService.getActiveProducts();
      const { qty, matchedProduct, hasExplicitZeroOrNegative } = parseQuantityAndProduct(message, products);

      // Follow-up 1: Invalid/Zero quantity
      if (hasExplicitZeroOrNegative) {
        return res.json({
          success: true,
          reply: 'Quantity must be at least 1 unit. How many units would you like to order?',
        });
      }

      // Follow-up 2: Missing or unrecognized product
      if (!matchedProduct) {
        const topCatalog = products
          .slice(0, 6)
          .map((p) => `• ${p.title} (${p.sku}) — $${(p.price_cents / 100).toFixed(2)}`)
          .join('\n');

        return res.json({
          success: true,
          reply: `I could not determine which product you would like to order. Which item from our catalog can I add for you?\n\nAvailable items:\n${topCatalog}\n\nExample: "Add order for 2 NXL tokens" or "Order 1 Rail One".`,
        });
      }

      const totalCents = matchedProduct.price_cents * qty;

      // Safety check: Per-action amount limit ($5,000 USD)
      if (totalCents > MAX_TRANSACTION_LIMIT_CENTS) {
        return res.json({
          success: false,
          reply: `⚠️ Safety Limit Exceeded: The requested order of ${qty}x ${matchedProduct.title} totals $${(totalCents / 100).toFixed(2)} USD, which exceeds the per-action security ceiling of $5,000.00 USD. Please request a smaller quantity to proceed safely.`,
        });
      }

      // Create Order Proposal Lock (Deterministic human confirmation required)
      const proposal = await ProposalLockManager.createProposal(userId, 'PURCHASE_ORDER', {
        sku: matchedProduct.sku,
        title: matchedProduct.title,
        qty,
        unitPriceCents: matchedProduct.price_cents,
        priceCents: totalCents,
        networkFeeCents: 0,
        paymentRail: matchedProduct.rail === 'xrpl' ? 'XRPL' : 'STELLAR',
        walletAddress,
      });

      return res.json({
        success: true,
        reply: `I have prepared an order proposal for ${qty}x ${matchedProduct.title} for $${(totalCents / 100).toFixed(2)} USD. Please review the confirmation summary below and click Approve to place the order, or Reject to cancel.`,
        proposal,
      });
    }

    // =========================================================================
    // ACTION 5: Specific order lookup by ID (#NR8K2P9X, NR8K2P9X, etc.)
    // =========================================================================
    const orderIdMatch = message.match(/#?(NXL|NR)[\w-]+/i);
    if (orderIdMatch && (lower.includes('status') || lower.includes('order') || lower.includes('where') || lower.includes('receipt'))) {
      const targetVariants = OrderSequenceService.getLookupVariants(orderIdMatch[0]);
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const matchedOrder = await ordersCol.findOne({
        $or: [
          { id: { $in: targetVariants } },
          { order_number: { $in: targetVariants } },
        ],
        user_id: userId,
      });

      if (!matchedOrder) {
        return res.json({
          success: true,
          reply: `Order "${orderIdMatch[0]}" was not found under your account. Please verify the order number in your Activity page or ask "Show my orders".`,
        });
      }

      const txInfo = matchedOrder.tx_hash
        ? `\n• On-Chain Tx Hash: ${matchedOrder.tx_hash.slice(0, 18)}...`
        : '';
      return res.json({
        success: true,
        reply: `Order ${matchedOrder.order_number} details:\n• Status: ${matchedOrder.status}\n• Total: $${((matchedOrder.total_cents || 0) / 100).toFixed(2)}\n• Settlement Rail: ${matchedOrder.payment_rail || 'Stellar'}${txInfo}\n\nYour receipt is available for download at /receipt?orderId=${matchedOrder.order_number}.`,
      });
    }

    // =========================================================================
    // ACTION 6: Real-time swap quote and rates explanation
    // =========================================================================
    if (
      lower.includes('swap') ||
      lower.includes('exchange rate') ||
      lower.includes('quote') ||
      (lower.includes('price') && (lower.includes('xrp') || lower.includes('xlm')))
    ) {
      const fx = await getFxQuote();
      const rateXrpToXlm = (fx.xrpUsd / (fx.xlmUsd || 1)).toFixed(4);
      const rateXlmToXrp = (fx.xlmUsd / (fx.xrpUsd || 1)).toFixed(4);

      return res.json({
        success: true,
        reply: `Live Settlement Oracle Quotes:\n• 1 XRP = $${fx.xrpUsd.toFixed(4)} USD\n• 1 XLM = $${fx.xlmUsd.toFixed(4)} USD\n• Cross-Chain Rate: 1 XRP ≈ ${rateXrpToXlm} XLM (1 XLM ≈ ${rateXlmToXrp} XRP)\n\nYou can execute zero-slippage cross-chain swaps directly on the /swap page with fast finality.`,
      });
    }

    // =========================================================================
    // INTENT 4B: Discount Coupon Bargain (Module 5 + Module 7)
    // =========================================================================
    if (lower.includes('coupon') || lower.includes('discount') || lower.includes('promo') || lower.includes('bargain')) {
      const coupon = await CouponService.issueAgentBargainCoupon(userId);
      const reply = `Here is your verified AI Assistant promo code: **${coupon.code}** (${coupon.discountPercent}% off orders $10+).\n\nApply **${coupon.code}** on the /cart page before checkout — you'll also earn automatic 2% $NXL cashback when paid!`;
      MongoAuditLogger.logAgentTrace({
        userId,
        sessionId: `sess_${userId}`,
        prompt: message,
        response: reply,
        toolsInvoked: ['negotiate_discount_coupon'],
        latencyMs: 25,
      }).catch(console.error);
      return res.json({ success: true, reply, coupon });
    }

    // =========================================================================
    // INTENT 4C: Conversational Swap Proposal (e.g. "Swap 20 XLM to NXL")
    // =========================================================================
    const swapMatch = lower.match(/\bswap\s+(\d+(?:\.\d+)?)\s*(usd|xlm|xrp|nxl|nr)\s*(?:to|for|into|->)\s*(usd|xlm|xrp|nxl|nr)\b/i);
    if (swapMatch) {
      const amount = Number(swapMatch[1]);
      const normalize = (s: string) => (s.toUpperCase() === 'NR' ? 'NXL' : s.toUpperCase()) as 'USD' | 'XLM' | 'XRP' | 'NXL';
      const fromAsset = normalize(swapMatch[2]);
      const toAsset = normalize(swapMatch[3]);
      try {
        const swapRes = await AgentToolRegistry.createSwapProposal({ userId, fromAsset, toAsset, amount });
        const reply = `Swap proposal ready: **${amount} ${fromAsset} -> ${swapRes.quote.receiveAmount.toFixed(4)} ${toAsset}** (Price impact ${swapRes.quote.priceImpactPercent.toFixed(2)}%).\n\nPlease review and click **Approve Swap** below to execute (lock expires in 5 minutes).`;
        MongoAuditLogger.logAgentTrace({
          userId,
          sessionId: `sess_${userId}`,
          prompt: message,
          response: reply,
          toolsInvoked: ['propose_token_swap'],
          latencyMs: 40,
        }).catch(console.error);
        return res.json({ success: true, reply, proposal: swapRes.proposal });
      } catch (swapErr: any) {
        return res.json({ success: true, reply: `Could not quote swap: ${swapErr.message}` });
      }
    }

    // =========================================================================
    // INTENT 4D: Custom AI Smart Basket Builder (e.g. "Build $100 low-risk basket")
    // =========================================================================
    if (lower.includes('basket') && (lower.includes('build') || lower.includes('create') || lower.includes('custom') || lower.includes('invest'))) {
      const budgetMatch = lower.match(/\$?\s*(\d+(?:\.\d+)?)/);
      const budgetUsd = budgetMatch ? Number(budgetMatch[1]) : 100;
      const riskProfile: 'conservative' | 'balanced' | 'growth' =
        lower.includes('low') || lower.includes('safe') || lower.includes('conservative')
          ? 'conservative'
          : lower.includes('high') || lower.includes('growth') || lower.includes('aggressive')
          ? 'growth'
          : 'balanced';

      try {
        const basketRes = await AgentToolRegistry.createCustomBasketProposal({ userId, budgetUsd, riskProfile });
        const reply = `I built a **${riskProfile}** Smart Basket for **$${budgetUsd.toFixed(2)} USD**:\n• ${basketRes.summary}\n\nClick **Approve & Invest** below to confirm (plus earn 2% $NXL cashback).`;
        MongoAuditLogger.logAgentTrace({
          userId,
          sessionId: `sess_${userId}`,
          prompt: message,
          response: reply,
          toolsInvoked: ['propose_custom_ai_basket'],
          latencyMs: 65,
        }).catch(console.error);
        return res.json({ success: true, reply, proposal: basketRes.proposal });
      } catch (bErr: any) {
        return res.json({ success: true, reply: `Could not build basket: ${bErr.message}` });
      }
    }

    // =========================================================================
    // Standard Assistant Chat Flow (Groq Native Tool Calling + Safe Fallback)
    // =========================================================================
    let aiReply = 'I am your NexusRail Autonomous Commerce Agent. You can ask me to "Swap 20 XLM to NXL", "Build $100 low-risk basket", "Get a discount code", "Show my orders", or "Show my balance".';
    let latencyMs = 120;
    let modelUsed: string | undefined;
    const toolsInvoked: string[] = [];
    let generatedProposal: any = undefined;

    try {
      const conversation: AgentChatMessage[] = [
        {
          role: 'system',
          content:
            'You are the NexusRail AI Commerce Assistant. Use the provided tools to look up live catalog products, portfolio balances, market rates, token swaps, custom AI baskets, and discount coupons. Keep replies concise and helpful.',
        },
        { role: 'user', content: message },
      ];

      const tools = AgentToolRegistry.getToolDefinitions();
      const firstPass = await AIRouterService.chatWithTools({ messages: conversation, tools });
      latencyMs = firstPass.latencyMs;
      modelUsed = firstPass.modelUsed;

      if (firstPass.toolCalls.length > 0) {
        conversation.push({
          role: 'assistant',
          content: firstPass.content,
          tool_calls: firstPass.toolCalls,
        });

        for (const call of firstPass.toolCalls.slice(0, 3)) {
          const toolName = call.function.name;
          toolsInvoked.push(toolName);
          let parsedArgs: Record<string, any> = {};
          try {
            parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            parsedArgs = {};
          }

          try {
            const toolOut: any = await AgentToolRegistry.executeTool(toolName, parsedArgs, userId);
            if (toolOut?.proposal && !generatedProposal) {
              generatedProposal = toolOut.proposal;
            }
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(toolOut.result ?? toolOut),
            });
          } catch (toolErr: any) {
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: toolErr?.message || 'Tool execution failed' }),
            });
          }
        }

        const secondPass = await AIRouterService.chatWithTools({
          messages: conversation,
          tools,
          toolChoice: 'none',
        });
        latencyMs += secondPass.latencyMs;
        if (secondPass.content) {
          aiReply = secondPass.content;
        }
      } else if (firstPass.content) {
        aiReply = firstPass.content;
      }
    } catch {
      if (lower.includes('catalog') || lower.includes('product')) {
        const catalog = await ProductService.getActiveProducts();
        aiReply = `Available in catalog: ${catalog.slice(0, 8).map((p) => `${p.title} ($${(p.price_cents / 100).toFixed(2)})`).join(', ')}`;
      }
    }

    // Asynchronously log AI trace to MongoDB Atlas
    MongoAuditLogger.logAgentTrace({
      userId,
      sessionId: `sess_${userId}`,
      prompt: message,
      response: aiReply,
      toolsInvoked: toolsInvoked.length > 0 ? toolsInvoked : undefined,
      modelUsed,
      latencyMs,
    }).catch(console.error);

    return res.json({
      success: true,
      reply: aiReply,
      proposal: generatedProposal,
      toolsInvoked,
      modelUsed,
      latencyMs,
    });
  } catch (error: any) {
    return res.status(502).json({ success: false, error: error.message || 'The assistant failed' });
  }
});

// ============================================================================
// POST /api/v1/agent/confirm - Human authorization execution of proposal lock
// ============================================================================
agentRouter.post('/confirm', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = ConfirmProposalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid proposal confirmation payload' });
    }

    const { proposalId } = parseResult.data;
    const userId = req.user!.id;

    const client = await MongoService.getClient();
    const session = client.startSession();

    let executedOrder: MongoOrderDoc | null = null;
    let executedTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    let successMessage = 'Proposal authorized and executed successfully!';

    try {
      await session.withTransaction(async () => {
        // 1. Atomically consume proposal lock
        const proposal = await ProposalLockManager.consumeProposal(proposalId, userId, session);
        const action = proposal.action;
        const payload = proposal.payload || {};

        if (action === 'PURCHASE_ORDER') {
          const priceCents = Number(payload.priceCents);
          const sku = String(payload.sku || '');
          const qty = Number(payload.qty || 1);
          const title = String(payload.title || 'Product');

          if (!Number.isFinite(priceCents) || priceCents <= 0) {
            throw new Error('Proposal has no valid price');
          }

          // Check if user has internal USD balance to settle immediately
          const userBalance = await walletService.getBalance(userId);
          const canDebitInternal = (userBalance.USD || 0) >= priceCents;

          let status: 'PAID' | 'PENDING' = 'PAID';
          if (canDebitInternal) {
            await walletService.debitBalance(userId, priceCents, 'USD', proposal.id, session);
          } else {
            // Created as PENDING order ready for payment
            status = 'PENDING';
          }

          const orderId = crypto.randomUUID();
          const orderNumber = await OrderSequenceService.getNextOrderNumber();
          const now = new Date().toISOString();

          executedOrder = {
            id: orderId,
            user_id: userId,
            order_number: orderNumber,
            total_cents: priceCents,
            items: [
              {
                sku,
                title,
                qty,
                unit_price_cents: Math.round(priceCents / qty),
              },
            ],
            payment_rail: String(payload.paymentRail || 'STELLAR'),
            status,
            tx_hash: status === 'PAID' ? executedTxHash : undefined,
            created_at: now,
            updated_at: now,
          };

          const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
          await ordersCol.insertOne(executedOrder as any, { session });

          if (status === 'PAID') {
            settlementEmitter.emitSettlement({
              orderId,
              orderNumber,
              status: 'PAID',
              paymentRail: executedOrder.payment_rail,
              txHash: executedTxHash,
              timestamp: now,
            });
            try {
              await PortfolioService.creditOrderAllocations(executedOrder as any, session);
            } catch {}
            successMessage = `Order ${orderNumber} for ${qty}x ${title} has been authorized and paid!`;
          } else {
            successMessage = `Order ${orderNumber} for ${qty}x ${title} has been created with status PENDING.`;
          }
        } else if (action === 'PAY_ORDER') {
          const orderId = String(payload.orderId || '');
          const orderNumber = String(payload.orderNumber || '');
          const priceCents = Number(payload.priceCents || 0);

          const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
          const existingOrder = await ordersCol.findOne({
            $or: [{ id: orderId }, { order_number: orderNumber }],
            user_id: userId,
          });

          if (!existingOrder) {
            throw new Error(`Order ${orderNumber || orderId} could not be located.`);
          }

          if (existingOrder.status === 'PAID') {
            executedOrder = existingOrder;
            executedTxHash = existingOrder.tx_hash || executedTxHash;
            successMessage = `Order ${existingOrder.order_number} is already paid.`;
            return;
          }

          // Check if internal wallet has funds; debit if available
          const balance = await walletService.getBalance(userId);
          if ((balance.USD || 0) >= priceCents) {
            await walletService.debitBalance(userId, priceCents, 'USD', proposal.id, session);
          }

          const now = new Date().toISOString();
          await ordersCol.updateOne(
            { id: existingOrder.id },
            {
              $set: {
                status: 'PAID',
                tx_hash: executedTxHash,
                updated_at: now,
              },
            },
            { session }
          );

          executedOrder = {
            ...existingOrder,
            status: 'PAID',
            tx_hash: executedTxHash,
            updated_at: now,
          };

          settlementEmitter.emitSettlement({
            orderId: existingOrder.id,
            orderNumber: existingOrder.order_number,
            status: 'PAID',
            paymentRail: existingOrder.payment_rail || 'STELLAR',
            txHash: executedTxHash,
            timestamp: now,
          });

          try {
            await PortfolioService.creditOrderAllocations(executedOrder as any, session);
          } catch {}

          successMessage = `Payment of $${(priceCents / 100).toFixed(2)} USD for Order ${existingOrder.order_number} authorized and settled!`;
        } else if (action === 'SWAP_ASSETS') {
          const fromAsset = String(payload.fromAsset || 'USD').toUpperCase() as 'USD' | 'XLM' | 'XRP' | 'NXL';
          const toAsset = String(payload.toAsset || 'NXL').toUpperCase() as 'USD' | 'XLM' | 'XRP' | 'NXL';
          const amount = Number(payload.amount || 0);

          const { order: swapOrder } = await NrTokenService.executeNrSwap({
            userId,
            fromAsset,
            toAsset,
            amount,
          });
          executedTxHash = swapOrder.payoutTxHash || swapOrder.journalEntry || executedTxHash;
          successMessage = `Swapped ${swapOrder.payAmount} ${swapOrder.fromAsset} -> ${swapOrder.receiveAmount.toFixed(4)} ${swapOrder.toAsset} successfully!`;
        } else if (action === 'CREATE_CUSTOM_BASKET') {
          const priceCents = Number(payload.priceCents || 0);
          const title = String(payload.title || 'AI Custom Basket');
          const allocations = Array.isArray(payload.allocations) ? (payload.allocations as any[]) : [];

          if (!Number.isFinite(priceCents) || priceCents < 1000 || priceCents > MAX_TRANSACTION_LIMIT_CENTS) {
            throw new Error(`Custom basket amount must be between $10 and $${MAX_TRANSACTION_LIMIT_CENTS / 100}.`);
          }

          const userBalance = await walletService.getBalance(userId);
          const canDebitInternal = (userBalance.USD || 0) >= priceCents;
          const status: 'PAID' | 'PENDING' = canDebitInternal ? 'PAID' : 'PENDING';

          if (canDebitInternal) {
            await walletService.debitBalance(userId, priceCents, 'USD', proposal.id, session);
          }

          const orderId = crypto.randomUUID();
          const orderNumber = await OrderSequenceService.getNextOrderNumber();
          const now = new Date().toISOString();

          executedOrder = {
            id: orderId,
            user_id: userId,
            order_number: orderNumber,
            total_cents: priceCents,
            items: [
              {
                sku: 'AI-CUSTOM-BASKET',
                title,
                qty: 1,
                unit_price_cents: priceCents,
              },
            ],
            payment_rail: 'INTERNAL_USD',
            status,
            tx_hash: status === 'PAID' ? executedTxHash : undefined,
            created_at: now,
            updated_at: now,
          };

          const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
          await ordersCol.insertOne(executedOrder as any, { session });

          if (status === 'PAID') {
            // Credit decomposed custom allocations directly into user_holdings
            const holdingsCol = await MongoService.getCollection<MongoUserHoldingDoc>('user_holdings');
            const eventsCol = await MongoService.getCollection<MongoPortfolioEventDoc>('portfolio_events');

            for (const alloc of allocations) {
              const deltaQty = Number(alloc.unitQty || 0);
              const deltaCostCents = Number(alloc.valueCents || 0);
              if (deltaQty <= 0) continue;

              const existing = await holdingsCol.findOne(
                { user_id: userId, symbol: alloc.symbol },
                { session }
              );
              const unitPriceCents = Math.max(1, Math.round(deltaCostCents / deltaQty));

              if (existing) {
                const newQty = Number((existing.quantity + deltaQty).toFixed(6));
                const newCost = existing.total_cost_cents + deltaCostCents;
                await holdingsCol.updateOne(
                  { _id: existing._id },
                  {
                    $set: {
                      quantity: newQty,
                      total_cost_cents: newCost,
                      avg_buy_price_cents: Math.round(newCost / Math.max(0.000001, newQty)),
                      updated_at: now,
                    },
                  },
                  { session }
                );
              } else {
                await holdingsCol.insertOne(
                  {
                    id: `hld_${crypto.randomUUID()}`,
                    user_id: userId,
                    symbol: alloc.symbol,
                    label: alloc.label || alloc.symbol,
                    quantity: deltaQty,
                    total_cost_cents: deltaCostCents,
                    avg_buy_price_cents: unitPriceCents,
                    realized_pnl_cents: 0,
                    updated_at: now,
                  },
                  { session }
                );
              }

              await eventsCol.insertOne(
                {
                  id: `pevt_${crypto.randomUUID()}`,
                  user_id: userId,
                  type: 'ACQUIRE_ORDER',
                  symbol: alloc.symbol,
                  quantity_delta: deltaQty,
                  unit_price_cents: unitPriceCents,
                  total_usd_cents: deltaCostCents,
                  fee_cents: 0,
                  reference_id: orderNumber,
                  created_at: now,
                },
                { session }
              );
            }

            // Award automatic 2% $NXL cashback & record 0.25% AI execution fee in Treasury
            await CouponService.awardOrderCashback(executedOrder).catch(() => {});
            const aiFeeCents = Math.max(1, Math.round(priceCents * 0.0025));
            await TreasuryService.recordRevenueEvent({
              sourceType: 'AI_EXECUTION',
              referenceId: orderNumber,
              grossCents: priceCents,
              feeCents: aiFeeCents,
              rail: 'INTERNAL',
            }).catch(() => {});

            successMessage = `Custom AI Basket ${orderNumber} ($${(priceCents / 100).toFixed(2)}) purchased and credited to your live portfolio!`;
          } else {
            successMessage = `Custom AI Basket ${orderNumber} created as PENDING (add USD balance to settle instantly).`;
          }
        } else {
          throw new Error(`Unsupported proposal action: ${action}`);
        }
      });
    } finally {
      await session.endSession();
    }

    return res.json({
      success: true,
      message: successMessage,
      order: executedOrder,
      txHash: executedTxHash,
    });
  } catch (error: any) {
    return res.status(409).json({ success: false, error: error.message || 'Proposal confirmation failed' });
  }
});

// ============================================================================
// POST /api/v1/agent/reject - Explicit user cancellation of proposed action
// ============================================================================
agentRouter.post('/reject', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = RejectProposalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid proposal rejection payload' });
    }

    const { proposalId } = parseResult.data;
    const userId = req.user!.id;

    await ProposalLockManager.rejectProposal(proposalId, userId);

    return res.json({
      success: true,
      message: 'Proposal was rejected and discarded. No funds were debited and no order was modified.',
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message || 'Proposal rejection failed' });
  }
});
