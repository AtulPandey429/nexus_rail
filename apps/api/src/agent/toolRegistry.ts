import { ProductService } from '../services/products.js';
import { walletService } from '../services/wallet.js';
import { RatesService } from '../services/rates.js';

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result: any;
}

export class AgentToolRegistry {
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

      default:
        throw new Error(`Tool '${toolName}' is not registered in AgentToolRegistry`);
    }
  }
}
