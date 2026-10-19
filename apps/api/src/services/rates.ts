import crypto from 'crypto';
import { getFxQuote, usdCentsToAsset } from './market.js';

export interface QuoteTicket {
  ticketId: string;
  orderId: string;
  amountUsdCents: number;
  assetSymbol: string;
  cryptoAmount: number;
  rateUsd: number;
  createdAt: string;
  expiresAt: string;
  signature: string;
}

export interface SlippageEvaluation {
  isExpired: boolean;
  slippagePercent: number;
  isAcceptable: boolean;
  deliveredUsdCents: number;
}

export class RatesService {
  private static getHmacSecret(): string {
    return process.env.JWT_SECRET || 'nexus_rail_rates_quote_v1_secret';
  }

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

  /**
   * Generates a cryptographically signed quote ticket with a strict validity TTL (default 300s = 5m).
   */
  static async generateQuoteTicket(
    orderId: string,
    amountUsdCents: number,
    assetSymbol: string,
    ttlSeconds = 300
  ): Promise<QuoteTicket> {
    const rates = await this.getExchangeRates();
    const symbol = assetSymbol.toUpperCase();
    const rateUsd = symbol === 'XRP' ? rates.XRP : rates.XLM;
    const cryptoAmount = await usdCentsToAsset(amountUsdCents, (symbol === 'XRP' ? 'XRP' : 'XLM') as any);

    const ticketId = `qt_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const payload = `${ticketId}:${orderId}:${amountUsdCents}:${cryptoAmount}:${expiresAt}:${symbol}`;
    const signature = crypto
      .createHmac('sha256', this.getHmacSecret())
      .update(payload)
      .digest('hex');

    return {
      ticketId,
      orderId,
      amountUsdCents,
      assetSymbol: symbol,
      cryptoAmount,
      rateUsd,
      createdAt,
      expiresAt,
      signature,
    };
  }

  /**
   * Verifies that the quote ticket signature is authentic and unaltered.
   */
  static verifyQuoteTicket(ticket: QuoteTicket): boolean {
    if (!ticket?.ticketId || !ticket?.orderId || !ticket?.signature) {
      return false;
    }

    const payload = `${ticket.ticketId}:${ticket.orderId}:${ticket.amountUsdCents}:${ticket.cryptoAmount}:${ticket.expiresAt}:${ticket.assetSymbol}`;
    const expected = crypto
      .createHmac('sha256', this.getHmacSecret())
      .update(payload)
      .digest('hex');

    const actualBuf = Buffer.from(ticket.signature);
    const expectedBuf = Buffer.from(expected);

    if (actualBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  }

  /**
   * Evaluates price slippage against merchant tolerance (max 1.5% adverse price movement).
   */
  static evaluateSlippage(ticket: QuoteTicket, currentPriceUsd: number, tolerancePercent = 1.5): SlippageEvaluation {
    const now = Date.now();
    const expiresAtMs = new Date(ticket.expiresAt).getTime();
    const isExpired = now > expiresAtMs;

    // Calculate current USD value of the quoted crypto amount
    const deliveredUsdCents = Math.round(ticket.cryptoAmount * currentPriceUsd * 100);

    // Slippage: positive means delivered is LESS than quoted amount (loss to merchant)
    const slippagePercent = ((ticket.amountUsdCents - deliveredUsdCents) / ticket.amountUsdCents) * 100;

    // Within validity period, lock is authoritative; after expiration, check slippage tolerance
    let isAcceptable = true;
    if (isExpired) {
      isAcceptable = slippagePercent <= tolerancePercent;
    }

    return {
      isExpired,
      slippagePercent,
      isAcceptable,
      deliveredUsdCents,
    };
  }
}
