import { getMetalQuote } from './market.js';

export class RwaGoldService {
  static async fetchLiveCommodityPrices() {
    const quote = await getMetalQuote();
    return {
      source: quote.source,
      fromCache: quote.fromCache,
      fetchedAt: quote.fetchedAt,
      goldUsd: quote.goldUsdPerGram,
      goldInr: quote.goldInrPerGram,
      silverUsd: quote.silverUsdPerGram,
      silverInr: quote.silverInrPerGram,
      gold: {
        symbol: 'PAXG',
        priceUsdPerGram: quote.goldUsdPerGram,
        priceInrPerGram: quote.goldInrPerGram,
        oracleSource: quote.fromCache ? 'CoinGecko cached quote' : 'CoinGecko',
      },
      silver: {
        symbol: 'KAG',
        priceUsdPerGram: quote.silverUsdPerGram,
        priceInrPerGram: quote.silverInrPerGram,
        oracleSource: quote.fromCache ? 'CoinGecko cached quote' : 'CoinGecko',
      },
    };
  }
}

export function tokenIssuanceUnavailable(): never {
  throw new Error('Token issuance is not available. A licensed issuer and custody provider are required.');
}
