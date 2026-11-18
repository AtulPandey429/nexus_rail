import { ProductService } from '../services/products.js';
import { walletService } from '../services/wallet.js';
import { RatesService } from '../services/rates.js';
import { getExtendedMarketSnapshot, getMetalQuote } from '../services/market.js';
import { PortfolioService } from '../services/portfolioService.js';
import { NrTokenService, NR_MICRO_SCALE } from '../services/nrTokenService.js';
import { CouponService } from '../services/couponService.js';
import { ProposalLockManager } from './proposalLock.js';
import type { GroqToolDefinition } from '../services/ai/aiRouter.js';
import type { AssetSymbol } from '../types/index.js';

const MAX_BASKET_BUDGET_USD = 5000;

export interface CustomBasketAllocation {
  symbol: AssetSymbol;
  label: string;
  weightPercent: number;
  unitQty: number;
  valueCents: number;
}

const RISK_PROFILES: Record<'conservative' | 'balanced' | 'growth', Array<{ symbol: AssetSymbol; weight: number }>> = {
  conservative: [
    { symbol: 'GOLD_G', weight: 60 },
    { symbol: 'USDC', weight: 30 },
    { symbol: 'SILVER_G', weight: 10 },
  ],
  balanced: [
    { symbol: 'GOLD_G', weight: 40 },
    { symbol: 'NXL', weight: 25 },
    { symbol: 'XRP', weight: 20 },
    { symbol: 'XLM', weight: 15 },
  ],
  growth: [
    { symbol: 'NXL', weight: 40 },
    { symbol: 'XRP', weight: 30 },
    { symbol: 'XLM', weight: 30 },
  ],
};

export class AgentToolRegistry {
  static getAllToolNames(): string[] {
    return this.getToolDefinitions().map((t) => t.function.name);
  }

  /**
   * OpenAI / Groq 2026 Native Tool Calling JSON Schemas
   */
  static getToolDefinitions(): GroqToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'search_live_catalog',
          description: 'Search live NexusRail store products, Smart Baskets, and RWA tokens with real-time prices.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Optional search keyword e.g. gold, basket, hardware' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_portfolio_and_balance',
          description: 'Fetch the signed-in user live wallet balances (USD, $NXL, XRP, XLM) and asset portfolio P&L.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_live_market_and_nxl_price',
          description: 'Get real-time oracle prices for Gold, Silver, XRP, XLM, and the $NXL AMM spot price.',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_token_swap',
          description: 'Create a 5-minute human-approved proposal lock to swap between USD, XLM, XRP, and NXL.',
          parameters: {
            type: 'object',
            properties: {
              fromAsset: { type: 'string', enum: ['USD', 'XLM', 'XRP', 'NXL'] },
              toAsset: { type: 'string', enum: ['NXL', 'USD', 'XLM', 'XRP'] },
              amount: { type: 'number', description: 'Positive amount to swap' },
            },
            required: ['fromAsset', 'toAsset', 'amount'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'propose_custom_ai_basket',
          description: 'Build a personalized multi-asset Smart Basket proposal based on USD budget and risk profile.',
          parameters: {
            type: 'object',
            properties: {
              budgetUsd: { type: 'number', description: 'Total budget in USD ($10 to $5000)' },
              riskProfile: { type: 'string', enum: ['conservative', 'balanced', 'growth'] },
            },
            required: ['budgetUsd', 'riskProfile'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'negotiate_discount_coupon',
          description: 'Issue the verified AGENT15 (15% off) promotional discount code for the user.',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];
  }

  /**
   * Builds live-priced custom basket allocations and creates a CREATE_CUSTOM_BASKET proposal lock
   */
  static async createCustomBasketProposal(params: {
    userId: string;
    budgetUsd: number;
    riskProfile: 'conservative' | 'balanced' | 'growth';
  }) {
    const budgetUsd = Number(params.budgetUsd);
    if (!Number.isFinite(budgetUsd) || budgetUsd < 10 || budgetUsd > MAX_BASKET_BUDGET_USD) {
      throw new Error(`Budget must be between $10 and $${MAX_BASKET_BUDGET_USD}.`);
    }

    const profile = RISK_PROFILES[params.riskProfile] || RISK_PROFILES.balanced;
    const [snapshot, nrPool] = await Promise.all([
      getExtendedMarketSnapshot(),
      NrTokenService.getPoolStats(),
    ]);

    const totalCents = Math.round(budgetUsd * 100);
    const allocations: CustomBasketAllocation[] = profile.map((entry) => {
      const valueCents = Math.round((totalCents * entry.weight) / 100);
      const { priceCents } = PortfolioService.getAssetPriceCents(entry.symbol, snapshot, nrPool.spotPriceCents);
      const unitQty = Number((valueCents / Math.max(1, priceCents)).toFixed(4));
      return {
        symbol: entry.symbol,
        label: PortfolioService.getAssetLabel(entry.symbol),
        weightPercent: entry.weight,
        unitQty,
        valueCents,
      };
    });

    const summary = allocations.map((a) => `${a.weightPercent}% ${a.symbol}`).join(' · ');
    const title = `AI ${params.riskProfile.charAt(0).toUpperCase() + params.riskProfile.slice(1)} Basket ($${budgetUsd.toFixed(2)})`;

    const proposal = await ProposalLockManager.createProposal(params.userId, 'CREATE_CUSTOM_BASKET', {
      title,
      sku: 'AI-CUSTOM-BASKET',
      qty: 1,
      riskProfile: params.riskProfile,
      priceCents: totalCents,
      allocations,
      itemsSummary: summary,
      paymentRail: 'INTERNAL_USD',
    });

    return {
      proposal: {
        proposalId: proposal.proposalId,
        action: 'CREATE_CUSTOM_BASKET' as const,
        title,
        sku: 'AI-CUSTOM-BASKET',
        qty: 1,
        priceCents: totalCents,
        paymentRail: 'INTERNAL_USD',
        itemsSummary: summary,
        allocations,
        status: 'PROPOSED' as const,
      },
      summary,
    };
  }

  /**
   * Quotes a swap and creates a 5-minute SWAP_ASSETS proposal lock
   */
  static async createSwapProposal(params: {
    userId: string;
    fromAsset: 'USD' | 'XLM' | 'XRP' | 'NXL';
    toAsset: 'USD' | 'XLM' | 'XRP' | 'NXL';
    amount: number;
  }) {
    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Swap amount must be greater than zero.');
    }
    if (params.fromAsset === params.toAsset) {
      throw new Error('Source and destination assets must be different.');
    }

    const quote = await NrTokenService.quoteSwap({
      fromAsset: params.fromAsset,
      toAsset: params.toAsset,
      amount,
    });

    const title = `Swap ${amount} ${params.fromAsset} -> ${quote.receiveAmount.toFixed(4)} ${params.toAsset}`;
    const priceCents = Math.max(1, Math.round(quote.inputUsdCents));

    const proposal = await ProposalLockManager.createProposal(params.userId, 'SWAP_ASSETS', {
      title,
      fromAsset: params.fromAsset,
      toAsset: params.toAsset,
      amount,
      receiveAmount: quote.receiveAmount,
      exchangeRate: quote.exchangeRate,
      priceImpactPercent: quote.priceImpactPercent,
      priceCents,
      paymentRail: 'NXL_AMM',
      itemsSummary: `${amount} ${params.fromAsset} -> ${quote.receiveAmount.toFixed(4)} ${params.toAsset} (Impact ${quote.priceImpactPercent.toFixed(2)}%)`,
    });

    return {
      proposal: {
        proposalId: proposal.proposalId,
        action: 'SWAP_ASSETS' as const,
        title,
        priceCents,
        paymentRail: 'NXL_AMM',
        itemsSummary: `${amount} ${params.fromAsset} -> ${quote.receiveAmount.toFixed(4)} ${params.toAsset}`,
        status: 'PROPOSED' as const,
      },
      quote,
    };
  }

  static async executeTool(toolName: string, args: Record<string, any>, userId: string) {
    switch (toolName) {
      case 'search_catalog':
      case 'search_live_catalog': {
        const products = await ProductService.getActiveProducts();
        const query = String(args.query || '').toLowerCase().trim();
        const filtered = query
          ? products.filter(
              (p) =>
                p.title.toLowerCase().includes(query) ||
                p.sku.toLowerCase().includes(query) ||
                (p.category || '').toLowerCase().includes(query)
            )
          : products.slice(0, 8);
        return {
          toolName,
          success: true,
          result: filtered.map((p) => ({
            sku: p.sku,
            title: p.title,
            priceUsd: Number((p.price_cents / 100).toFixed(2)),
            category: p.category,
            isBasket: Boolean(p.is_basket),
          })),
        };
      }
      case 'check_wallet_balance':
      case 'get_portfolio_and_balance': {
        const [balance, portfolio, pool] = await Promise.all([
          walletService.getBalance(userId),
          PortfolioService.getUserPortfolio(userId).catch(() => null),
          NrTokenService.getPoolStats().catch(() => null),
        ]);
        return {
          toolName,
          success: true,
          result: {
            usdBalance: Number(((balance.USD || 0) / 100).toFixed(2)),
            nxlBalance: Number(((balance.NXL || 0) / NR_MICRO_SCALE).toFixed(4)),
            nxlSpotUsd: pool ? pool.spotPriceUsd : 1,
            portfolioValueUsd: portfolio ? Number((portfolio.total_current_value_cents / 100).toFixed(2)) : 0,
            unrealizedPnlUsd: portfolio ? Number((portfolio.total_unrealized_pnl_cents / 100).toFixed(2)) : 0,
            unrealizedPnlPercent: portfolio ? portfolio.total_unrealized_pnl_percent : 0,
            holdingsCount: portfolio?.holdings?.length || 0,
          },
        };
      }
      case 'get_exchange_rates':
      case 'get_live_gold_rates':
      case 'get_live_market_and_nxl_price': {
        const [rates, metals, pool] = await Promise.all([
          RatesService.getExchangeRates(),
          getMetalQuote(),
          NrTokenService.getPoolStats(),
        ]);
        return {
          toolName,
          success: true,
          result: {
            xrpUsd: rates.XRP,
            xlmUsd: rates.XLM,
            nxlSpotUsd: pool.spotPriceUsd,
            goldUsdPerGram: metals.goldUsdPerGram,
            silverUsdPerGram: metals.silverUsdPerGram,
          },
        };
      }
      case 'propose_token_swap': {
        const fromAsset = String(args.fromAsset || 'XLM').toUpperCase() as any;
        const toAsset = String(args.toAsset || 'NXL').toUpperCase() as any;
        const amount = Number(args.amount || 0);
        const data = await this.createSwapProposal({ userId, fromAsset, toAsset, amount });
        return { toolName, success: true, result: data, proposal: data.proposal };
      }
      case 'propose_custom_ai_basket': {
        const budgetUsd = Number(args.budgetUsd || 100);
        const rawRisk = String(args.riskProfile || 'balanced').toLowerCase();
        const riskProfile = (['conservative', 'balanced', 'growth'].includes(rawRisk)
          ? rawRisk
          : 'balanced') as 'conservative' | 'balanced' | 'growth';
        const data = await this.createCustomBasketProposal({ userId, budgetUsd, riskProfile });
        return { toolName, success: true, result: data, proposal: data.proposal };
      }
      case 'negotiate_discount_coupon': {
        const coupon = await CouponService.issueAgentBargainCoupon(userId);
        return { toolName, success: true, result: coupon };
      }
      default:
        throw new Error(`Tool '${toolName}' is not registered`);
    }
  }
}
