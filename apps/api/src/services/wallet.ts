import type { DbWalletTransaction, WalletCurrency } from '@nexusrail/shared';
import type { ClientSession } from 'mongodb';
import { MongoService, MongoWalletTxDoc, MongoWalletBalanceDoc } from './mongo.js';
import crypto from 'crypto';

const currencies: WalletCurrency[] = ['USD', 'XRP', 'XLM'];

export class WalletService {
  /**
   * O(1) Atomic Account Balance Reader with lazy migration fallback
   */
  async getBalance(userId: string): Promise<Record<WalletCurrency, number>> {
    const balance: Record<WalletCurrency, number> = { USD: 0, XRP: 0, XLM: 0 };

    try {
      const balancesCol = await MongoService.getCollection<MongoWalletBalanceDoc>('wallet_balances');
      const docs = await balancesCol.find({ user_id: userId }).toArray();

      if (docs.length > 0) {
        for (const doc of docs) {
          if (currencies.includes(doc.currency)) {
            balance[doc.currency] = doc.available_cents;
          }
        }
        return balance;
      }

      // Fallback & Lazy Initialization: If no balance record exists, calculate from legacy ledger
      const ledgerCol = await MongoService.getCollection<MongoWalletTxDoc>('wallet_ledger');
      const txs = await ledgerCol.find({ user_id: userId }).toArray();

      if (txs.length === 0) {
        return balance;
      }

      for (const tx of txs) {
        if (!currencies.includes(tx.currency)) continue;
        const sign = tx.type === 'CREDIT' ? 1 : -1;
        balance[tx.currency] += sign * Number(tx.amount_cents);
      }

      // Materialize initial balance snapshot asynchronously for O(1) future reads
      const now = new Date().toISOString();
      for (const curr of currencies) {
        if (balance[curr] > 0) {
          await balancesCol.updateOne(
            { user_id: userId, currency: curr },
            {
              $set: {
                available_cents: balance[curr],
                locked_cents: 0,
                version: 1,
                updated_at: now,
              },
            },
            { upsert: true }
          );
        }
      }
    } catch {
      // In offline/test environments without Mongo connection, return zero balances
    }

    return balance;
  }

  /**
   * Applies a financial ledger entry guarded by atomic conditional increments and optional MongoDB sessions
   */
  async applyEntry(
    userId: string,
    amountCents: number,
    type: 'CREDIT' | 'DEBIT',
    currency: WalletCurrency,
    referenceId: string,
    session?: ClientSession
  ): Promise<DbWalletTransaction> {
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const roundedAmount = Math.round(amountCents);
    const now = new Date().toISOString();
    const balancesCol = await MongoService.getCollection<MongoWalletBalanceDoc>('wallet_balances');

    let updatedBalanceDoc: MongoWalletBalanceDoc | null = null;

    if (type === 'DEBIT') {
      // ATOMIC OVERDRAFT DEFENSE:
      // Conditional criteria guarantees debit ONLY executes if available_cents >= roundedAmount
      const updateOptions: any = { returnDocument: 'after' };
      if (session) updateOptions.session = session;

      const res: any = await balancesCol.findOneAndUpdate(
        {
          user_id: userId,
          currency,
          available_cents: { $gte: roundedAmount },
        },
        {
          $inc: { available_cents: -roundedAmount, version: 1 },
          $set: { updated_at: now },
        },
        updateOptions
      );

      const doc: MongoWalletBalanceDoc | null = res?.value || res;

      if (!doc) {
        const currentBalances = await this.getBalance(userId);
        const currentBalance = currentBalances[currency] || 0;
        throw new Error(
          `Insufficient ${currency} balance (Available: $${(currentBalance / 100).toFixed(2)}, Required: $${(roundedAmount / 100).toFixed(2)})`
        );
      }
      updatedBalanceDoc = doc;
    } else {
      // ATOMIC CREDIT: Upsert balance document
      const updateOptions: any = { returnDocument: 'after', upsert: true };
      if (session) updateOptions.session = session;

      const res: any = await balancesCol.findOneAndUpdate(
        { user_id: userId, currency },
        {
          $inc: { available_cents: roundedAmount, version: 1 },
          $setOnInsert: { locked_cents: 0 },
          $set: { updated_at: now },
        },
        updateOptions
      );
      updatedBalanceDoc = res?.value || res;
    }

    const balanceAfter = updatedBalanceDoc?.available_cents ?? (type === 'CREDIT' ? roundedAmount : 0);
    const txId = crypto.randomUUID();

    const txDoc: MongoWalletTxDoc = {
      id: txId,
      user_id: userId,
      currency,
      amount_cents: roundedAmount,
      type,
      reference_id: referenceId,
      balance_after: balanceAfter,
      created_at: now,
    };

    const ledgerCol = await MongoService.getCollection<MongoWalletTxDoc>('wallet_ledger');
    const insertOptions: any = {};
    if (session) insertOptions.session = session;
    await ledgerCol.insertOne(txDoc as any, insertOptions);

    return {
      id: txDoc.id,
      user_id: txDoc.user_id,
      currency: txDoc.currency,
      amount_cents: txDoc.amount_cents,
      type: txDoc.type,
      reference_id: txDoc.reference_id,
      balance_after: txDoc.balance_after,
      created_at: txDoc.created_at,
    };
  }

  async creditBalance(
    userId: string,
    amountCents: number,
    currency: WalletCurrency = 'USD',
    referenceId = 'deposit',
    session?: ClientSession
  ) {
    return this.applyEntry(userId, amountCents, 'CREDIT', currency, referenceId, session);
  }

  async debitBalance(
    userId: string,
    amountCents: number,
    currency: WalletCurrency = 'USD',
    referenceId = 'purchase_order',
    session?: ClientSession
  ) {
    return this.applyEntry(userId, amountCents, 'DEBIT', currency, referenceId, session);
  }

  async getTransactions(userId: string): Promise<DbWalletTransaction[]> {
    const col = await MongoService.getCollection<MongoWalletTxDoc>('wallet_ledger');
    const docs = await col.find({ user_id: userId }).sort({ created_at: -1 }).toArray();

    return docs.map((tx) => ({
      id: tx.id,
      user_id: tx.user_id,
      currency: tx.currency,
      amount_cents: tx.amount_cents,
      type: tx.type,
      reference_id: tx.reference_id,
      balance_after: tx.balance_after,
      created_at: tx.created_at,
    }));
  }
}

export const walletService = new WalletService();
