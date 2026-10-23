import { getMetalQuote } from '../market.js';

export class RwaOracleService {
  static async getLiveCommodityRates() {
    return getMetalQuote();
  }
}
