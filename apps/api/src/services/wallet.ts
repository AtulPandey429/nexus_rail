import type { DbWalletTransaction, WalletCurrency } from '@nexusrail/shared';
import { MongoService, MongoWalletTxDoc } from './mongo.js';
import crypto from 'crypto';

const currencies: WalletCurrency[] = ['USD', 'XRP', 'XLM'];

export class WalletService {
  async getBalance(userId: string): Promise<Record<WalletCurrency, number>> {
    const col = await MongoService.getCollection<MongoWalletTxDoc>('wallet_ledger');
    const txs = await col.find({ user_id: userId }).toArray();

    const balance: Record<WalletCurrency, number> = { USD: 0, XRP: 0, XLM: 0 };
    for (const tx of txs) {
      if (!currencies.includes(tx.currency)) continue;
      const sign = tx.type === 'CREDIT' ? 1 : -1;
      balance[tx.currency] += sign * Number(tx.amount_cents);
    }

    return balance;
  }

  async applyEntry(
    userId: string,
    amountCents: number,
    type: 'CREDIT' | 'DEBIT',
    currency: WalletCurrency,
    referenceId: string
  ): Promise<DbWalletTransaction> {
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const currentBalances = await this.getBalance(userId);
    const currentBalance = currentBalances[currency] || 0;

    if (type === 'DEBIT' && currentBalance < amountCents) {
      throw new Error(`Insufficient ${currency} balance (Available: $${(currentBalance / 100).toFixed(2)}, Required: $${(amountCents / 100).toFixed(2)})`);
    }

    const balanceAfter = type === 'CREDIT' ? currentBalance + amountCents : currentBalance - amountCents;
    const txId = crypto.randomUUID();
    const now = new Date().toISOString();

    const txDoc: MongoWalletTxDoc = {
      id: txId,
      user_id: userId,
      currency,
      amount_cents: Math.round(amountCents),
      type,
      reference_id: referenceId,
      balance_after: Math.round(balanceAfter),
      created_at: now,
    };

    const col = await MongoService.getCollection<MongoWalletTxDoc>('wallet_ledger');
    await col.insertOne(txDoc as any);

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

  async creditBalance(userId: string, amountCents: number, currency: WalletCurrency = 'USD', referenceId = 'deposit') {
    return this.applyEntry(userId, amountCents, 'CREDIT', currency, referenceId);
  }

  async debitBalance(userId: string, amountCents: number, currency: WalletCurrency = 'USD', referenceId = 'purchase_order') {
    return this.applyEntry(userId, amountCents, 'DEBIT', currency, referenceId);
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
