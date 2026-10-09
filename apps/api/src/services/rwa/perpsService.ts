export interface OstiumPerpQuote {
  pair: 'XAU/USD' | 'XAG/USD';
  leverage: number; // 2x - 5x
  indexPriceUsd: number;
  entryPriceUsd: number;
  estimatedFundingRate: number;
  requiredMarginUsd: number;
  liquidationPriceUsd: number;
}

export class RwaPerpsService {
  /**
   * Generates Ostium Gold & Silver Leverage Futures Quote
   */
  static getPerpsQuote(pair: 'XAU/USD' | 'XAG/USD', leverage: number, positionSizeUsd: number): OstiumPerpQuote {
    const spotPrice = pair === 'XAU/USD' ? 2740.50 : 32.50;
    const requiredMarginUsd = positionSizeUsd / leverage;
    const liqBuffer = spotPrice * (0.8 / leverage);
    const liquidationPriceUsd = spotPrice - liqBuffer;

    return {
      pair,
      leverage,
      indexPriceUsd: spotPrice,
      entryPriceUsd: spotPrice,
      estimatedFundingRate: 0.0001,
      requiredMarginUsd: Number(requiredMarginUsd.toFixed(2)),
      liquidationPriceUsd: Number(liquidationPriceUsd.toFixed(2)),
    };
  }
}
