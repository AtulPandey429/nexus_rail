import { ProductService } from '../services/products.js';
import { walletService } from '../services/wallet.js';
import { RatesService } from '../services/rates.js';
import { getMetalQuote } from '../services/market.js';

export class AgentToolRegistry {
  static getAllToolNames(): string[] {
    return ['search_catalog', 'check_wallet_balance', 'get_exchange_rates', 'get_live_gold_rates'];
  }

  static async executeTool(toolName: string, args: Record<string, any>, userId: string) {
    switch (toolName) {
      case 'search_catalog': {
        const products = await ProductService.getActiveProducts();
        const query = String(args.query || '').toLowerCase();
        const filtered = query
          ? products.filter((product) => product.title.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query))
          : products;
        return { toolName, success: true, result: filtered };
      }
      case 'check_wallet_balance':
        return { toolName, success: true, result: await walletService.getBalance(userId) };
      case 'get_exchange_rates':
        return { toolName, success: true, result: await RatesService.getExchangeRates() };
      case 'get_live_gold_rates':
        return { toolName, success: true, result: await getMetalQuote() };
      case 'mint_gold_tokens':
      case 'open_perp_position':
        throw new Error(`${toolName} is not available. No licensed issuer or perpetuals provider is configured.`);
      default:
        throw new Error(`Tool '${toolName}' is not registered`);
    }
  }
}
