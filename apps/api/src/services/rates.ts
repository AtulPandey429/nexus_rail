import { getFxQuote, usdCentsToAsset } from './market.js';

export class RatesService {
  static async getExchangeRates() {
    const quote = await getFxQuote();
    return {
      USD: 1,
      XRP: quote.xrpUsd,
      XLM: quote.xlmUsd,
      source: quote.source,
      fromCache: quote.fromCache,
      timestamp: quote.fetchedAt,
    };
  }

  static async convertCentsToCrypto(cents: number, currency: 'XRP' | 'XLM'): Promise<number> {
    return usdCentsToAsset(cents, currency);
  }
}
