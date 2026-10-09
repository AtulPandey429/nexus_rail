import { ProductService } from '../services/products.js';
import { walletService } from '../services/wallet.js';
import { RatesService } from '../services/rates.js';

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result: any;
}

export class AgentToolRegistry {
  static getAllToolNames(): string[] {
    return [
      'search_catalog',
      'check_wallet_balance',
      'get_exchange_rates',
      'get_live_gold_rates',
      'mint_gold_tokens',
      'open_perp_position',
    ];
  }

  static async executeTool(toolName: string, args: Record<string, any>, userId: string): Promise<ToolExecutionResult> {
    switch (toolName) {
      case 'search_catalog': {
        const products = await ProductService.getActiveProducts();
        const query = args.query ? args.query.toLowerCase() : '';
        const filtered = products.filter(
          (p) => p.title.toLowerCase().includes(query) || p.category.toLowerCase().includes(query)
        );
        return { toolName, success: true, result: filtered };
      }

      case 'check_wallet_balance': {
        const balances = await walletService.getBalance(userId);
        return { toolName, success: true, result: balances };
      }

      case 'get_exchange_rates': {
        const rates = await RatesService.getExchangeRates();
        return { toolName, success: true, result: rates };
      }

      case 'get_live_gold_rates': {
        return {
          toolName,
          success: true,
          result: { goldUsdPerGram: 88.25, goldInrPerGram: 7420.0, silverUsdPerGram: 1.05, silverInrPerGram: 88.5 },
        };
      }

      case 'mint_gold_tokens': {
        const grams = args.grams || 1.0;
        const txHash = `tx_stl_testnet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        return {
          toolName,
          success: true,
          result: {
            assetCode: 'nGOLD',
            amountGrams: grams,
            txHash,
            explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
          },
        };
      }

      case 'open_perp_position': {
        const pair = args.pair || 'XAU/USD';
        const leverage = args.leverage || 2;
        return {
          toolName,
          success: true,
          result: { pair, leverage, sizeUsd: 100, marginUsd: 50, liquidationPrice: 2400.0 },
        };
      }

      default:
        throw new Error(`Tool '${toolName}' is not registered in AgentToolRegistry`);
    }
  }
}
