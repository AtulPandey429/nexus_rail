import type { DbWalletTransaction, WalletCurrency } from '@nexusrail/shared';

// In-memory mock wallet ledger store with atomic concurrency protection
const userBalances = new Map<string, Record<WalletCurrency, number>>();
const transactionHistory: DbWalletTransaction[] = [];

export class WalletService {
  private flexKey(userId: string): Record<WalletCurrency, number> {
    if (!userBalances.has(userId)) {
      userBalances.set(userId, { USD: 10000, XRP: 500, XLM: 1000 }); // Default starting balance (in cents/units)
    }
    return userBalances.get(userId)!;
  }

  async getBalance(userId: string): Promise<Record<WalletCurrency, number>> {
    return this.flexKey(userId);
  }

  async creditBalance(
    userId: string,
    amountCents: number,
    currency: WalletCurrency = 'USD',
    referenceId: string = 'deposit_manual'
  ): Promise<DbWalletTransaction> {
    if (amountCents <= 0) {
      throw new Error('Credit amount must be greater than zero');
    }

    const balances = this.flexKey(userId);
    balances[currency] += amountCents;

    const tx: DbWalletTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      currency,
      amount_cents: amountCents,
      type: 'CREDIT',
      reference_id: referenceId,
      balance_after: balances[currency],
      created_at: new Date().toISOString(),
    };

    transactionHistory.push(tx);
    return tx;
  }

  async debitBalance(
    userId: string,
    amountCents: number,
    currency: WalletCurrency = 'USD',
    referenceId: string = 'purchase_order'
  ): Promise<DbWalletTransaction> {
    if (amountCents <= 0) {
      throw new Error('Debit amount must be greater than zero');
    }

    const balances = this.flexKey(userId);
    if (balances[currency] < amountCents) {
      throw new Error(`Insufficient ${currency} balance for debit transaction`);
    }

    balances[currency] -= amountCents;

    const tx: DbWalletTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      currency,
      amount_cents: amountCents,
      type: 'DEBIT',
      reference_id: referenceId,
      balance_after: balances[currency],
      created_at: new Date().toISOString(),
    };

    transactionHistory.push(tx);
    return tx;
  }

  async getTransactions(userId: string): Promise<DbWalletTransaction[]> {
    return transactionHistory
      .filter((tx) => tx.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

export const walletService = new WalletService();
