export interface ExchangeRates {
  USD: number;
  XRP: number;
  XLM: number;
  timestamp: string;
}

export class RatesService {
  static async getExchangeRates(): Promise<ExchangeRates> {
    return {
      USD: 1.0,
      XRP: 2.15, // 1 USD = 2.15 XRP
      XLM: 4.80, // 1 USD = 4.80 XLM
      timestamp: new Date().toISOString(),
    };
  }

  static async convertCentsToCrypto(cents: number, currency: 'XRP' | 'XLM'): Promise<number> {
    const usd = cents / 100;
    const rates = await this.getExchangeRates();
    return parseFloat((usd * rates[currency]).toFixed(4));
  }
}
