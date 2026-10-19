import { Horizon, StrKey, TransactionBuilder, Operation, Asset, Memo, Networks } from '@stellar/stellar-sdk';
import crypto from 'crypto';
import type { IChainProvider, ChainInvoice, ChainVerificationResult, ChainNetwork } from '@nexusrail/shared';
import { env } from '../../config/env.js';
import { usdCentsToAsset, getFxQuote } from '../market.js';

export const CIRCLE_USDC_TESTNET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const CIRCLE_USDC_TESTNET_ASSET = new Asset('USDC', CIRCLE_USDC_TESTNET_ISSUER);

export class StellarTestnetProvider implements IChainProvider {
  readonly chainId: string = 'stellar';
  readonly assetSymbol: string = 'XLM';
  readonly network: ChainNetwork = 'testnet';

  protected horizonServer: Horizon.Server;
  protected defaultMerchantAddress = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';

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

  /**
   * Pre-builds a valid, standard unsigned Stellar payment XDR transaction
   * for client wallet signing (Freighter, Albedo, etc.)
   */
  async buildPaymentXdr(sourcePublicKey: string, amountXlm: number, memoText: string): Promise<string> {
    if (!StrKey.isValidEd25519PublicKey(sourcePublicKey)) {
      throw new Error('Invalid Stellar source public key');
    }

    const sourceAccount = await this.horizonServer.loadAccount(sourcePublicKey);
    const recipient = this.getMerchantAddress();

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '100', // standard 100 stroops
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: recipient,
          asset: Asset.native(),
          amount: amountXlm.toFixed(7),
        })
      )
      .addMemo(Memo.text(memoText.slice(0, 28)))
      .setTimeout(300) // 5-minute timeout window
      .build();

    return tx.toXDR();
  }

  /**
   * Submits a client-signed XDR envelope to the Stellar Horizon Testnet
   */
  async submitSignedXdr(signedXdr: string): Promise<{ txHash: string; ledger: number; successful: boolean }> {
    try {
      const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
      const res: any = await this.horizonServer.submitTransaction(tx);
      return {
        txHash: res.hash,
        ledger: res.ledger,
        successful: Boolean(res.successful),
      };
    } catch (err: any) {
      const resultCodes = err?.response?.data?.extras?.result_codes;
      const detail = resultCodes ? JSON.stringify(resultCodes) : err.message;
      throw new Error(`Stellar Horizon transaction submission rejected: ${detail}`);
    }
  }

  /**
   * Scans the 20 most recent Stellar transactions to find an incoming payment with the matching HMAC memo
   */
  async findRecentPaymentByMemo(expectedMemo: string): Promise<string | null> {
    try {
      const merchantVault = this.getMerchantAddress();
      const txPage: any = await this.horizonServer
        .transactions()
        .forAccount(merchantVault)
        .order('desc')
        .limit(20)
        .call();

      for (const tx of txPage.records) {
        if (tx.successful && tx.memo && tx.memo.toUpperCase() === expectedMemo.toUpperCase()) {
          return tx.hash;
        }
      }
      return null;
    } catch (err: any) {
      console.warn('⚠️ [StellarTestnetProvider findRecentPaymentByMemo]:', err.message);
      return null;
    }
  }

  /**
   * Authoritative Payment Verification on Stellar Horizon:
   * Inspects operations to verify payment recipient, exact delivered amount,
   * native asset type, and matching HMAC memo.
   */
  async verifyPayment(orderId: string, txHash: string, expectedAmountAsset?: number): Promise<ChainVerificationResult> {
    try {
      const tx = await this.horizonServer.transactions().transaction(txHash).call();
      
      const memoHash = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(orderId).digest('hex');
      const expectedMemo = (`NR${memoHash}`).slice(0, 28).toUpperCase();
      
      // Memo verification: Must be present and match exactly
      const memoMatches = Boolean(tx.memo && tx.memo.toUpperCase() === expectedMemo);

      if (!tx.successful) {
        return {
          verified: false,
          txHash,
          assetSymbol: this.assetSymbol,
          network: this.network,
          error: 'Transaction failed on the Stellar ledger',
        };
      }

      if (!memoMatches) {
        return {
          verified: false,
          txHash,
          assetSymbol: this.assetSymbol,
          network: this.network,
          error: 'Transaction memo does not match order payment specification',
        };
      }

      // Authoritative Operation Inspection: Verify destination and delivered amount
      const ops = await tx.operations();
      const merchantVault = this.getMerchantAddress();

      const paymentOp = ops.records.find((op: any) => 
        op.type === 'payment' &&
        op.to === merchantVault &&
        op.asset_type === 'native'
      );

      if (!paymentOp) {
        return {
          verified: false,
          txHash,
          assetSymbol: this.assetSymbol,
          network: this.network,
          error: 'No payment operation to merchant vault found in transaction',
        };
      }

      const delivered = parseFloat((paymentOp as any).amount || '0');
      const amountMatches = expectedAmountAsset
        ? delivered >= expectedAmountAsset * 0.999 // 0.1% tolerance
        : delivered > 0;

      if (!amountMatches) {
        return {
          verified: false,
          txHash,
          assetSymbol: this.assetSymbol,
          network: this.network,
          error: `Delivered amount (${delivered} XLM) is less than invoice requirement (${expectedAmountAsset} XLM)`,
        };
      }

      return {
        verified: true,
        txHash: tx.hash,
        sourceAddress: tx.source_account,
        destinationAddress: merchantVault,
        amountDelivered: delivered,
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
        error: `Stellar Horizon verification failed: ${err.message}`,
      };
    }
  }
}

/**
 * FEAT-03: Native Stellar Circle USDC Stablecoin Settlement Provider
 * Delivers exact 1:1 USD pricing without crypto conversion volatility.
 */
export class StellarUsdcTestnetProvider extends StellarTestnetProvider {
  override readonly chainId = 'stellar-usdc';
  override readonly assetSymbol = 'USDC';

  override async createInvoice(orderId: string, amountUsdCents: number): Promise<ChainInvoice> {
    const amountUsdc = Number((amountUsdCents / 100).toFixed(2));
    const recipient = this.getMerchantAddress();

    const memoHash = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(orderId).digest('hex');
    const memoText = (`NR${memoHash}`).slice(0, 28).toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return {
      orderId,
      chain: this.chainId,
      network: this.network,
      recipientAddress: recipient,
      paymentIdentifierType: 'memo_text',
      paymentIdentifier: memoText,
      amountAsset: amountUsdc,
      assetSymbol: 'USDC',
      amountDropsOrStroops: String(Math.round(amountUsdc * 10_000_000)),
      amountUsdCents,
      fxRateUsd: 1.0,
      expiresAt,
      explorerUrl: `https://stellar.expert/explorer/testnet/account/${recipient}`,
      qrPayload: `stellar:pay?destination=${recipient}&amount=${amountUsdc}&asset_code=USDC&asset_issuer=${CIRCLE_USDC_TESTNET_ISSUER}&memo=${memoText}`,
    };
  }

  override async buildPaymentXdr(sourcePublicKey: string, amountUsdc: number, memoText: string): Promise<string> {
    if (!StrKey.isValidEd25519PublicKey(sourcePublicKey)) {
      throw new Error('Invalid Stellar source public key');
    }

    const sourceAccount = await this.horizonServer.loadAccount(sourcePublicKey);
    const recipient = this.getMerchantAddress();

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: recipient,
          asset: CIRCLE_USDC_TESTNET_ASSET,
          amount: amountUsdc.toFixed(7),
        })
      )
      .addMemo(Memo.text(memoText.slice(0, 28)))
      .setTimeout(300)
      .build();

    return tx.toXDR();
  }

  override async verifyPayment(orderId: string, txHash: string, expectedAmountAsset?: number): Promise<ChainVerificationResult> {
    try {
      const tx = await this.horizonServer.transactions().transaction(txHash).call();
      const memoHash = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_memo').update(orderId).digest('hex');
      const expectedMemo = (`NR${memoHash}`).slice(0, 28).toUpperCase();

      const memoMatches = Boolean(tx.memo && tx.memo.toUpperCase() === expectedMemo);

      if (!tx.successful) {
        return {
          verified: false,
          txHash,
          assetSymbol: 'USDC',
          network: this.network,
          error: 'Transaction failed on the Stellar ledger',
        };
      }

      if (!memoMatches) {
        return {
          verified: false,
          txHash,
          assetSymbol: 'USDC',
          network: this.network,
          error: 'Transaction memo does not match order payment specification',
        };
      }

      const ops = await tx.operations();
      const merchantVault = this.getMerchantAddress();

      const paymentOp = ops.records.find((op: any) =>
        op.type === 'payment' &&
        op.to === merchantVault &&
        op.asset_code === 'USDC' &&
        op.asset_issuer === CIRCLE_USDC_TESTNET_ISSUER
      );

      if (!paymentOp) {
        return {
          verified: false,
          txHash,
          assetSymbol: 'USDC',
          network: this.network,
          error: 'No valid Circle USDC payment operation found matching merchant vault and issuer',
        };
      }

      const deliveredAmount = parseFloat((paymentOp as any).amount);
      if (expectedAmountAsset && deliveredAmount < expectedAmountAsset) {
        return {
          verified: false,
          txHash,
          assetSymbol: 'USDC',
          network: this.network,
          error: `Delivered USDC amount (${deliveredAmount}) is less than required (${expectedAmountAsset})`,
        };
      }

      return {
        verified: true,
        txHash,
        sourceAddress: tx.source_account,
        destinationAddress: merchantVault,
        amountDelivered: deliveredAmount,
        assetSymbol: 'USDC',
        ledgerIndex: tx.ledger_attr,
        timestamp: tx.created_at,
        network: this.network,
      };
    } catch (err: any) {
      return {
        verified: false,
        txHash,
        assetSymbol: 'USDC',
        network: this.network,
        error: `Stellar Horizon verification failed: ${err.message}`,
      };
    }
  }
}
