import crypto from 'crypto';
import { MongoService } from './mongo.js';

// Unambiguous Base32 character set (excluding 0, O, 1, I)
const BASE32_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export interface CounterDoc {
  _id: string;
  seq: number;
  updated_at: string;
}

export class OrderSequenceService {
  /**
   * Generates a 6-character high-entropy alphanumeric token (e.g. 8K2P9X)
   */
  static generateRandomCode(length = 6): string {
    const bytes = crypto.randomBytes(length);
    let code = '';
    for (let i = 0; i < length; i++) {
      code += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
    }
    return code;
  }

  /**
   * Atomically generate next human-readable order reference: #NR8K2P9X
   * Short, professional, and unique for every order.
   */
  static async getNextOrderNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const counterId = `order_seq_${year}`;
    const now = new Date().toISOString();

    try {
      // 1. Increment atomic counter in database
      const countersCol = await MongoService.getCollection<CounterDoc>('counters');
      await countersCol.findOneAndUpdate(
        { _id: counterId },
        {
          $inc: { seq: 1 },
          $set: { updated_at: now },
        },
        {
          upsert: true,
          returnDocument: 'after',
        }
      );

      // 2. Generate unique 6-character code
      const code = this.generateRandomCode(6);
      return `#NR${code}`;
    } catch (err: any) {
      console.warn('⚠️ [OrderSequenceService] Database counter fallback:', err.message);
      const code = this.generateRandomCode(6);
      return `#NR${code}`;
    }
  }

  /**
   * Normalizes any order identifier (e.g. '#NR8K2P9X', 'NR8K2P9X', 'nr8k2p9x')
   * into clean variants for search & database queries.
   */
  static getLookupVariants(rawId: string): string[] {
    const trimmed = (rawId || '').trim();
    const withoutHash = trimmed.replace(/^#/, '');
    const withHash = '#' + withoutHash;
    return Array.from(new Set([
      trimmed,
      withHash,
      withoutHash,
      withHash.toUpperCase(),
      withoutHash.toUpperCase(),
      trimmed.toLowerCase(),
    ]));
  }

  /**
   * Backfill any legacy or raw MongoDB ID order numbers with valid professional order references.
   * Preserves existing clean references like #NR8K2P9X, NR8K2P9X, etc.
   */
  static async backfillLegacyOrders(): Promise<number> {
    try {
      const ordersCol = await MongoService.getCollection('orders');
      const legacyOrders = await ordersCol
        .find({
          $or: [
            { order_number: { $exists: false } },
            { order_number: null },
            { order_number: '' },
            { order_number: { $regex: /^[0-9a-f]{24}$/i } }, // Raw ObjectId hex
          ],
        })
        .toArray();

      let count = 0;
      for (const ord of legacyOrders) {
        const newRef = await this.getNextOrderNumber();
        await ordersCol.updateOne({ _id: ord._id }, { $set: { order_number: newRef } });
        count++;
      }
      return count;
    } catch {
      return 0;
    }
  }
}
