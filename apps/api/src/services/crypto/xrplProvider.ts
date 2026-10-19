import { Client, isValidClassicAddress } from 'xrpl';
import crypto from 'crypto';
import type { IChainProvider, ChainInvoice, ChainVerificationResult, ChainNetwork } from '@nexusrail/shared';
import { env } from '../../config/env.js';
import { usdCentsToAsset, getFxQuote } from '../market.js';

export class XrplTestnetProvider implements IChainProvider {
  readonly chainId = 'xrpl';
  readonly assetSymbol = 'XRP';
  readonly network: ChainNetwork = 'testnet';

  private client: Client;
  private isConnected = false;
  private connectingPromise: Promise<void> | null = null;
  private defaultMerchantAddress = 'rp4Q7LTC8pg5jSprV92jRdoZ9E2rhMNFxW'; // Live faucet funded address

  private endpoints: string[];
  private currentEndpointIndex = 0;

  constructor() {
    const primaryWss = env.XRPL_WSS || env.XRPL_TESTNET_WSS || 'wss://s.altnet.rippletest.net:51233';
    this.endpoints = [primaryWss, 'wss://testnet.xrpl-labs.com'].filter(Boolean);
    this.client = new Client(this.endpoints[0], {
      connectionTimeout: 8000,
    });
    this.attachClientListeners();
  }

  private attachClientListeners(): void {
    this.client.on('disconnected', (code: any) => {
      this.isConnected = false;
      console.warn(`⚡ [XrplTestnetProvider] WebSocket connection dropped (code: ${code}). Auto-reconnect ready.`);
    });

    this.client.on('error', (errorCode: any, errorMessage: any) => {
      console.warn(`⚠️ [XrplTestnetProvider Socket Warning]: ${errorCode} - ${errorMessage}`);
    });
  }

  private async ensureConnected(): Promise<Client> {
    if (this.client.isConnected()) {
      return this.client;
    }

    if (this.connectingPromise) {
      await this.connectingPromise;
      return this.client;
    }

    this.connectingPromise = (async () => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < this.endpoints.length; attempt++) {
        const targetEndpoint = this.endpoints[(this.currentEndpointIndex + attempt) % this.endpoints.length];
        try {
          // If switching endpoints, instantiate a fresh client
          if (this.client.url !== targetEndpoint) {
            try {
              if (this.client.isConnected()) await this.client.disconnect();
            } catch {}
            this.client = new Client(targetEndpoint, { connectionTimeout: 8000 });
            this.attachClientListeners();
          }

          await this.client.connect();
          this.isConnected = true;
          this.currentEndpointIndex = (this.currentEndpointIndex + attempt) % this.endpoints.length;
          console.log(`⚡ [XrplTestnetProvider] Connected to XRPL Testnet: ${targetEndpoint}`);
          return;
        } catch (err: any) {
          lastError = err;
          console.warn(`⚠️ [XrplTestnetProvider Connection Attempt ${attempt + 1} Failed (${targetEndpoint})]:`, err.message);
        }
      }

      throw lastError || new Error('Failed to connect to any XRPL testnet endpoint');
    })().finally(() => {
      this.connectingPromise = null;
    });

    await this.connectingPromise;
    return this.client;
  }

  /**
   * Pings the active XRPL node to verify connection health
   */
  async ping(): Promise<boolean> {
    try {
      const client = await this.ensureConnected();
      const res: any = await client.request({ command: 'ping' });
      return res?.result?.status === 'success' || res?.status === 'success' || Boolean(res?.result);
    } catch {
      return false;
    }
  }

  getMerchantAddress(): string {
    const configured = env.XRPL_MERCHANT_ADDRESS;
    if (configured && isValidClassicAddress(configured)) {
      return configured;
    }
    return this.defaultMerchantAddress;
  }

  validateAddress(address: string): boolean {
    return isValidClassicAddress(address);
  }

  getExplorerUrl(txHash: string): string {
    return `https://testnet.xrpl.org/transactions/${txHash}`;
  }

  async getAccountBalance(address?: string): Promise<{ balance: number; currency: string }> {
    const target = address || this.getMerchantAddress();
    const client = await this.ensureConnected();

    try {
      const response = await client.request({
        command: 'account_info',
        account: target,
        ledger_index: 'validated',
      });

      const balanceDrops = response.result.account_data.Balance;
      const balanceXrp = Number(balanceDrops) / 1_000_000;
      return { balance: balanceXrp, currency: 'XRP' };
    } catch (err: any) {
      throw new Error(`Failed to load XRPL testnet account (${target}): ${err.message}`);
    }
  }

  async createInvoice(orderId: string, amountUsdCents: number): Promise<ChainInvoice> {
    const amountXrp = await usdCentsToAsset(amountUsdCents, 'XRP');
    const fx = await getFxQuote();
    const recipient = this.getMerchantAddress();

    // NexusRail Bespoke Dual-Rail Tag Engine:
    // Computes a deterministic, collision-resistant 32-bit unsigned destination tag
    // using domain-separated HMAC-SHA256 within the safe ledger range [100000, 2147483647].
    const tagDigest = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_tag').update(orderId).digest();
    const destinationTag = (tagDigest.readUInt32BE(0) % 2_000_000_000) + 100_000;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const amountDrops = String(Math.round(amountXrp * 1_000_000));

    return {
      orderId,
      chain: this.chainId,
      network: this.network,
      recipientAddress: recipient,
      paymentIdentifierType: 'destination_tag',
      paymentIdentifier: destinationTag,
      amountAsset: amountXrp,
      assetSymbol: this.assetSymbol,
      amountDropsOrStroops: amountDrops,
      amountUsdCents,
      fxRateUsd: fx.xrpUsd,
      expiresAt,
      explorerUrl: `https://testnet.xrpl.org/accounts/${recipient}`,
      qrPayload: `xrpl:${recipient}?amount=${amountDrops}&dt=${destinationTag}`,
    };
  }

  async verifyPayment(orderId: string, txHash: string, expectedAmountAsset?: number): Promise<ChainVerificationResult> {
    const client = await this.ensureConnected();

    try {
      const txRes: any = await client.request({
        command: 'tx',
        transaction: txHash,
      });

      const result = txRes.result;
      const meta = result?.meta;
      const txSuccess = meta?.TransactionResult === 'tesSUCCESS';

      // Verify destination
      const recipient = this.getMerchantAddress();
      const destinationMatches = result?.Destination === recipient;

      // Verify destination tag using the matching bespoke HMAC derivation
      const tagDigest = crypto.createHmac('sha256', 'nexus_rail_settlement_v1_tag').update(orderId).digest();
      const expectedTag = (tagDigest.readUInt32BE(0) % 2_000_000_000) + 100_000;
      const tagMatches = result?.DestinationTag === expectedTag;

      // Authoritative Delivered Amount inspection (Prevents XRPL Partial Payment exploit)
      let deliveredXrp = 0;
      if (meta && typeof meta === 'object') {
        const deliv = (meta as any).delivered_amount || (meta as any).DeliveredAmount;
        if (deliv) {
          deliveredXrp = typeof deliv === 'string' ? Number(deliv) / 1_000_000 : Number(deliv.value || 0);
        }
      }
      if (deliveredXrp === 0 && result?.Amount && typeof result.Amount === 'string') {
        deliveredXrp = Number(result.Amount) / 1_000_000;
      }

      const amountMatches = expectedAmountAsset ? deliveredXrp >= expectedAmountAsset * 0.999 : deliveredXrp > 0;
      const verified = Boolean(result?.validated && txSuccess && destinationMatches && tagMatches && amountMatches);

      return {
        verified,
        txHash,
        sourceAddress: result?.Account,
        destinationAddress: result?.Destination,
        amountDelivered: deliveredXrp,
        assetSymbol: this.assetSymbol,
        ledgerIndex: result?.ledger_index,
        timestamp: new Date().toISOString(),
        network: this.network,
        error: !verified ? 'Transaction does not match order parameters, delivered insufficient funds, or is unvalidated' : undefined,
      };
    } catch (err: any) {
      return {
        verified: false,
        txHash,
        assetSymbol: this.assetSymbol,
        network: this.network,
        error: `XRPL testnet lookup failed: ${err.message}`,
      };
    }
  }

  /**
   * Scans recent account transactions to find an incoming payment with the matching DestinationTag
   */
  async findRecentPaymentByDestinationTag(expectedTag: number): Promise<string | null> {
    try {
      const client = await this.ensureConnected();
      const merchantVault = this.getMerchantAddress();
      const res: any = await client.request({
        command: 'account_tx',
        account: merchantVault,
        limit: 20,
      });

      const txs = res.result?.transactions || [];
      for (const record of txs) {
        const tx = record.tx || record.tx_json || record;
        const meta = record.meta;
        const isSuccess = meta?.TransactionResult === 'tesSUCCESS';
        if (
          isSuccess &&
          tx?.Destination === merchantVault &&
          Number(tx?.DestinationTag) === expectedTag
        ) {
          return tx.hash;
        }
      }
      return null;
    } catch (err: any) {
      console.warn('⚠️ [XrplTestnetProvider findRecentPaymentByDestinationTag]:', err.message);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.isConnected()) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }
}
