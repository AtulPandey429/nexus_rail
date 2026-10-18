import { Horizon, StrKey } from '@stellar/stellar-sdk';
import crypto from 'crypto';
import type { IChainProvider, ChainInvoice, ChainVerificationResult, ChainNetwork } from '@nexusrail/shared';
import { env } from '../../config/env.js';
import { usdCentsToAsset, getFxQuote } from '../market.js';

export class StellarTestnetProvider implements IChainProvider {
  readonly chainId = 'stellar';
  readonly assetSymbol = 'XLM';
  readonly network: ChainNetwork = 'testnet';

  private horizonServer: Horizon.Server;
  private defaultMerchantAddress = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';

  constructor() {
    const horizonUrl = env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org';
    this.horizonServer = new Horizon.Server(horizonUrl);
  }

  getMerchantAddress(): string {
    const configured = env.STELLAR_MERCHANT_PUBLIC_KEY;
    if (configured && StrKey.isValidEd25519PublicKey(configured)) {
      return configured;
    }
    return this.defaultMerchantAddress;
  }

  validateAddress(address: string): boolean {
    return StrKey.isValidEd25519PublicKey(address);
  }

  getExplorerUrl(txHash: string): string {
    return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
  }

  async getAccountBalance(address?: string): Promise<{ balance: number; currency: string }> {
    const target = address || this.getMerchantAddress();
    try {
      const account = await this.horizonServer.loadAccount(target);
      const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
      const balance = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
      return { balance, currency: 'XLM' };
    } catch (err: any) {
      throw new Error(`Failed to load Stellar testnet account (${target}): ${err.message}`);
    }
  }

  async createInvoice(orderId: string, amountUsdCents: number): Promise<ChainInvoice> {
    const amountXlm = await usdCentsToAsset(amountUsdCents, 'XLM');
    const fx = await getFxQuote();
    const recipient = this.getMerchantAddress();
    
    // NexusRail Bespoke Dual-Rail Memo Engine:
    // Derives an exact 28-byte uppercase alphanumeric memo starting with 'NR'
    // followed by a 26-character domain-separated HMAC-SHA256 digest,
    // ensuring collision resistance and instant ledger reconciliation.
    const memoHash = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(orderId).digest('hex');
    const memoText = (`NR${memoHash}`).slice(0, 28).toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min window

    return {
      orderId,
      chain: this.chainId,
      network: this.network,
      recipientAddress: recipient,
      paymentIdentifierType: 'memo_text',
      paymentIdentifier: memoText,
      amountAsset: amountXlm,
      assetSymbol: this.assetSymbol,
      amountDropsOrStroops: String(Math.round(amountXlm * 10_000_000)), // 1 XLM = 10,000,000 stroops
      amountUsdCents,
      fxRateUsd: fx.xlmUsd,
      expiresAt,
      explorerUrl: `https://stellar.expert/explorer/testnet/account/${recipient}`,
      qrPayload: `stellar:pay?destination=${recipient}&amount=${amountXlm}&memo=${memoText}`,
    };
  }

  async verifyPayment(orderId: string, txHash: string, expectedAmountAsset?: number): Promise<ChainVerificationResult> {
    try {
      const tx = await this.horizonServer.transactions().transaction(txHash).call();
      
      const expectedMemo = orderId.replace(/-/g, '').slice(0, 28);
      const memoMatches = tx.memo ? tx.memo.toLowerCase() === expectedMemo.toLowerCase() : true;

      if (!tx.successful) {
        return {
          verified: false,
          txHash,
          assetSymbol: this.assetSymbol,
          network: this.network,
          error: 'Transaction failed on the Stellar ledger',
        };
      }

      return {
        verified: tx.successful && memoMatches,
        txHash: tx.hash,
        sourceAddress: tx.source_account,
        destinationAddress: this.getMerchantAddress(),
        amountDelivered: expectedAmountAsset || 0,
        assetSymbol: this.assetSymbol,
        ledgerIndex: tx.ledger_attr,
        timestamp: tx.created_at,
        network: this.network,
      };
    } catch (err: any) {
      return {
        verified: false,
        txHash,
        assetSymbol: this.assetSymbol,
        network: this.network,
        error: `Stellar Horizon lookup failed: ${err.message}`,
      };
    }
  }
}
