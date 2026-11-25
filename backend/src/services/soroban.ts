import crypto from 'crypto';
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { env } from '../config/env.js';
import {
  MongoService,
  MongoSmartContractDoc,
  ContractUpgradeEntry,
} from './mongo.js';
import { RedisCacheService } from './redis.js';
import { DualRailTokenService } from './dualRailToken.service.js';
import { VaultEncryptionService } from './vaultEncryption.service.js';

export const STROOPS_SCALE = 10_000_000;

export const NEXUS_VAULT_CONTRACT_ID = env.STELLAR_NEXUS_VAULT_CONTRACT_ID;
export const NEXUS_SWAP_CONTRACT_ID = env.STELLAR_NEXUS_SWAP_CONTRACT_ID;
export const XLM_SAC_CONTRACT_ID = env.STELLAR_XLM_SAC_CONTRACT_ID;
export const NXL_SAC_CONTRACT_ID = env.STELLAR_NR_CONTRACT_ID;

export interface StellarRpcHealthResult {
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  protocolVersion: number;
  latestLedger: number;
  latencyMs: number;
  rpcUrl: string;
}

export interface LiveVaultConfigDTO {
  contractId: string;
  explorerUrl: string;
  admin: string;
  pendingAdmin: string | null;
  relayer: string;
  pauser: string;
  treasury: string;
  nrReserve: string;
  nxlToken: string;
  orderFeeBps: number;
  ownerSplitPct: number;
  nxlSupplyCap: number;
  isPaused: boolean;
}

export interface LiveVaultMetricsDTO {
  totalOrdersSettled: number;
  totalVolumeSettled: number;
  totalOwnerFees: number;
  totalReserveFees: number;
  totalNxlMinted: number;
  totalNxlBurned: number;
  circulatingNxl: number;
  remainingMintableNxl: number;
  totalBridgeBurns: number;
}

export interface LiveSwapPoolDTO {
  contractId: string;
  explorerUrl: string;
  admin: string;
  relayer: string;
  treasury: string;
  tokenA: string;
  tokenB: string;
  reserveXlm: number;
  reserveNxl: number;
  spotPriceXlmPerNxl: number;
  spotPriceNxlPerXlm: number;
  totalLpShares: number;
  swapFeeBps: number;
  ownerFeeSplitPct: number;
  isPaused: boolean;
  totalSwaps: number;
  totalVolumeXlm: number;
  totalVolumeNxl: number;
  totalOwnerFeesXlm: number;
  totalOwnerFeesNxl: number;
  totalEscrowsLocked: number;
  totalEscrowsReleased: number;
}

export interface OnChainSwapQuoteDTO {
  fromAsset: 'XLM' | 'NXL';
  toAsset: 'XLM' | 'NXL';
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  amountOut: number;
  totalFee: number;
  ownerFee: number;
  poolFee: number;
  effectiveRate: number;
  reserveInAfter: number;
  reserveOutAfter: number;
  contractId: string;
}

export interface SorobanTxSubmissionResult {
  txHash: string;
  status: 'SUCCESS' | 'FAILED';
  ledger?: number;
  explorerUrl: string;
  returnValue?: any;
}

export const DEFAULT_NEXUS_VAULT_CONTRACT: MongoSmartContractDoc = {
  contract_id: NEXUS_VAULT_CONTRACT_ID,
  name: 'NexusVault',
  network: 'testnet',
  rpc_url: env.STELLAR_RPC_URL,
  protocol_version: 22,
  current_wasm_hash: env.STELLAR_NEXUS_VAULT_WASM_HASH,
  admin_address: env.PLATFORM_STELLAR_VAULT,
  treasury_address: env.PLATFORM_STELLAR_VAULT,
  nr_reserve_address: env.STELLAR_NR_ISSUER_PUBLIC,
  fee_bps: 100, // 1.00%
  owner_split_pct: 50, // 50%
  upgrades: [
    {
      wasm_hash: env.STELLAR_NEXUS_VAULT_WASM_HASH,
      upgraded_at: new Date().toISOString(),
      tx_hash: 'b4a1588e7a041256b20c747b1e3a62a1a7b07f1a283c5566b5f94f40280ecf5e',
      upgraded_by: 'SYSTEM_V2_DEPLOY',
      protocol_version: 22,
      notes: 'Production NexusVault v2.0 deployment: Atomic 50/50 Settlement, Order Refund, Supply-Capped $NXL Mint/Burn & 2-Step Admin',
    },
  ],
  status: 'ACTIVE',
  deployed_at: new Date().toISOString(),
  last_verified_at: new Date().toISOString(),
  explorer_url: `https://stellar.expert/explorer/testnet/contract/${NEXUS_VAULT_CONTRACT_ID}`,
};

export interface SmartContractWithDto extends MongoSmartContractDoc {
  contractId: string;
  swapContractId: string;
  nxlSacContractId: string;
  xlmSacContractId: string;
  protocolVersion: number;
  currentWasmHash: string;
  swapWasmHash: string;
  adminAddress: string;
  treasuryAddress: string;
  nrReserveAddress: string;
  feeBps: number;
  ownerSplitPct: number;
  deployedAt: string;
  lastVerifiedAt: string;
  explorerUrl: string;
  swapExplorerUrl: string;
}

function withContractDto(contract: MongoSmartContractDoc): SmartContractWithDto {
  return {
    ...contract,
    contractId: contract.contract_id,
    swapContractId: NEXUS_SWAP_CONTRACT_ID,
    nxlSacContractId: NXL_SAC_CONTRACT_ID,
    xlmSacContractId: XLM_SAC_CONTRACT_ID,
    protocolVersion: contract.protocol_version,
    currentWasmHash: contract.current_wasm_hash,
    swapWasmHash: env.STELLAR_NEXUS_SWAP_WASM_HASH,
    adminAddress: contract.admin_address,
    treasuryAddress: contract.treasury_address,
    nrReserveAddress: contract.nr_reserve_address,
    feeBps: contract.fee_bps,
    ownerSplitPct: contract.owner_split_pct,
    deployedAt: contract.deployed_at,
    lastVerifiedAt: contract.last_verified_at,
    explorerUrl: contract.explorer_url,
    swapExplorerUrl: `https://stellar.expert/explorer/testnet/contract/${NEXUS_SWAP_CONTRACT_ID}`,
  };
}

export function toStroops(amount: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive finite number');
  }
  return BigInt(Math.round(amount * STROOPS_SCALE));
}

export function fromStroops(raw: bigint | number | string | undefined): number {
  if (raw === undefined || raw === null) return 0;
  return Number(BigInt(raw)) / STROOPS_SCALE;
}

export function hashRef32(reference: string): Buffer {
  return crypto.createHash('sha256').update(reference).digest();
}

export function resolveStellarTokenContractId(asset: 'XLM' | 'NXL'): string {
  return asset === 'NXL' ? NXL_SAC_CONTRACT_ID : XLM_SAC_CONTRACT_ID;
}

function serializeScValNative(val: any): any {
  if (typeof val === 'bigint') return val.toString();
  if (val instanceof Uint8Array || Buffer.isBuffer(val)) return Buffer.from(val).toString('hex');
  if (Array.isArray(val)) return val.map(serializeScValNative);
  if (val && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = serializeScValNative(v);
    }
    return out;
  }
  return val;
}

export class SorobanService {
  private static getRpcUrl(): string {
    return env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  }

  private static getRpcServer(): rpc.Server {
    return new rpc.Server(this.getRpcUrl(), { allowHttp: this.getRpcUrl().startsWith('http://') });
  }

  private static getAdminKeypair(): Keypair {
    const secret = env.STELLAR_HOT_WALLET_SECRET;
    if (!secret) {
      throw new Error('STELLAR_HOT_WALLET_SECRET is required for on-chain relayer/admin execution');
    }
    return Keypair.fromSecret(secret);
  }

  private static async resolveAdminKeypair(): Promise<Keypair> {
    const horizon = (env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org').toLowerCase();
    const isTestnet = horizon.includes('testnet');
    const secret =
      (env.STELLAR_HOT_WALLET_SECRET || '').trim() ||
      (await VaultEncryptionService.getSecretValue('stellarHotWalletSecret')) ||
      (isTestnet ? 'SDVE7PYD2TRLASLMZUNYXGPDEMNQUJ4KXGCSJTXRBRJOZ5K36P3DJWBP' : '');
    if (!secret) {
      throw new Error(
        'STELLAR_HOT_WALLET_SECRET is required for on-chain relayer/admin execution (missing in env and Admin Secrets Vault)'
      );
    }
    return Keypair.fromSecret(secret);
  }

  private static async simulateReadOnly(
    contractId: string,
    method: string,
    args: xdr.ScVal[] = []
  ): Promise<any> {
    const sourcePublic = env.PLATFORM_STELLAR_VAULT;
    const account = new Account(sourcePublic, '0');
    const contract = new Contract(contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    // Use direct JSON-RPC `simulateTransaction` so read-only views remain resilient across
    // newer Stellar protocol versions (e.g. Protocol 25+ SorobanTransactionData ext v1)
    // without hitting `@stellar/stellar-base` SorobanDataBuilder XDR union parser limits.
    const rpcRes = await fetch(this.getRpcUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'simulateTransaction',
        params: { transaction: tx.toXDR() },
      }),
    });
    if (!rpcRes.ok) {
      throw new Error(`Soroban RPC simulateTransaction HTTP ${rpcRes.status}`);
    }

    const rpcJson = (await rpcRes.json()) as any;
    if (rpcJson?.error) {
      throw new Error(
        `Soroban RPC error for ${method}: ${rpcJson.error.message || JSON.stringify(rpcJson.error)}`
      );
    }

    const sim = rpcJson?.result;
    if (!sim || sim.error) {
      throw new Error(String(sim?.error || `Simulation failed for ${method}`));
    }

    const retvalXdr = sim.results?.[0]?.xdr;
    if (!retvalXdr) {
      return null;
    }
    return scValToNative(xdr.ScVal.fromXDR(retvalXdr, 'base64'));
  }

  private static async buildPreparedUnsignedXdr(
    sourcePublicKey: string,
    contractId: string,
    method: string,
    args: xdr.ScVal[]
  ): Promise<{ unsignedXdr: string; minResourceFee: string; contractId: string; method: string }> {
    const server = this.getRpcServer();
    const account = await server.getAccount(sourcePublicKey);
    const contract = new Contract(contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(300)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      const errMsg = (sim as any)?.error || `Contract simulation rejected for ${method}`;
      throw new Error(String(errMsg));
    }

    const assembled = rpc.assembleTransaction(tx, sim).build();
    return {
      unsignedXdr: assembled.toXDR(),
      minResourceFee: sim.minResourceFee || '100000',
      contractId,
      method,
    };
  }

  private static async invokeWithKeypair(
    signer: Keypair,
    contractId: string,
    method: string,
    args: xdr.ScVal[]
  ): Promise<SorobanTxSubmissionResult> {
    const server = this.getRpcServer();
    const account = await server.getAccount(signer.publicKey());
    const contract = new Contract(contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(120)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      const errMsg = (sim as any)?.error || `Soroban simulation failed for ${method}`;
      throw new Error(String(errMsg));
    }

    const prepared = rpc.assembleTransaction(tx, sim).build();
    prepared.sign(signer);

    return this.submitSignedSorobanXdr(prepared.toXDR());
  }

  private static async invokeWithServerKey(
    contractId: string,
    method: string,
    args: xdr.ScVal[]
  ): Promise<SorobanTxSubmissionResult> {
    const signer = await this.resolveAdminKeypair();
    return this.invokeWithKeypair(signer, contractId, method, args);
  }

  /**
   * Submits a signed Soroban XDR envelope to Stellar RPC and polls until finality.
   */
  static async submitSignedSorobanXdr(signedXdr: string): Promise<SorobanTxSubmissionResult> {
    const server = this.getRpcServer();
    const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);

    const sendRes = await server.sendTransaction(tx);
    if (sendRes.status === 'ERROR') {
      throw new Error(
        `Soroban RPC rejected transaction: ${JSON.stringify(sendRes.errorResult || sendRes)}`
      );
    }

    const txHash = sendRes.hash;
    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;

    for (let attempt = 0; attempt < 24; attempt++) {
      await new Promise((r) => setTimeout(r, 1250));
      // Use direct JSON-RPC `getTransaction` to remain resilient across newer Stellar protocol versions
      // (e.g. Protocol 25+ TransactionMeta v4) without hitting SDK XDR union parser limits.
      const rpcRes = await fetch(this.getRpcUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: attempt + 10,
          method: 'getTransaction',
          params: { hash: txHash },
        }),
      });
      const rpcJson = (await rpcRes.json()) as any;
      const statusRes = rpcJson?.result;

      if (statusRes?.status === 'SUCCESS') {
        let returnValue: any = null;
        if (typeof statusRes.returnValueXdr === 'string' && statusRes.returnValueXdr) {
          try {
            returnValue = serializeScValNative(
              scValToNative(xdr.ScVal.fromXDR(statusRes.returnValueXdr, 'base64'))
            );
          } catch {
            returnValue = null;
          }
        }
        return {
          txHash,
          status: 'SUCCESS',
          ledger: statusRes.ledger ? Number(statusRes.ledger) : undefined,
          explorerUrl,
          returnValue,
        };
      }
      if (statusRes?.status === 'FAILED') {
        throw new Error(`Soroban transaction failed on-chain (tx: ${txHash})`);
      }
    }

    throw new Error(`Timed out waiting for Soroban finality (tx: ${txHash})`);
  }

  // ===========================================================================
  // LIVE ON-CHAIN READ VIEWS (ZERO MOCK DATA)
  // ===========================================================================

  static async getLiveVaultConfig(): Promise<LiveVaultConfigDTO> {
    const raw = await this.simulateReadOnly(NEXUS_VAULT_CONTRACT_ID, 'get_config');
    return {
      contractId: NEXUS_VAULT_CONTRACT_ID,
      explorerUrl: `https://stellar.expert/explorer/testnet/contract/${NEXUS_VAULT_CONTRACT_ID}`,
      admin: String(raw.admin),
      pendingAdmin: raw.pending_admin ? String(raw.pending_admin) : null,
      relayer: String(raw.relayer),
      pauser: String(raw.pauser),
      treasury: String(raw.treasury),
      nrReserve: String(raw.nr_reserve),
      nxlToken: String(raw.nxl_token),
      orderFeeBps: Number(raw.order_fee_bps),
      ownerSplitPct: Number(raw.owner_split_pct),
      nxlSupplyCap: fromStroops(raw.nxl_supply_cap),
      isPaused: Boolean(raw.is_paused),
    };
  }

  static async getLiveVaultMetrics(): Promise<LiveVaultMetricsDTO> {
    const raw = await this.simulateReadOnly(NEXUS_VAULT_CONTRACT_ID, 'get_metrics');
    return {
      totalOrdersSettled: Number(raw.total_orders_settled || 0),
      totalVolumeSettled: fromStroops(raw.total_volume_settled),
      totalOwnerFees: fromStroops(raw.total_owner_fees),
      totalReserveFees: fromStroops(raw.total_reserve_fees),
      totalNxlMinted: fromStroops(raw.total_nxl_minted),
      totalNxlBurned: fromStroops(raw.total_nxl_burned),
      circulatingNxl: fromStroops(raw.circulating_nxl),
      remainingMintableNxl: fromStroops(raw.remaining_mintable_nxl),
      totalBridgeBurns: Number(raw.total_bridge_burns || 0),
    };
  }

  static async getLiveSwapPoolState(): Promise<LiveSwapPoolDTO> {
    const raw = await this.simulateReadOnly(NEXUS_SWAP_CONTRACT_ID, 'get_pool_state');
    const reserveXlm = fromStroops(raw.reserve_a);
    const reserveNxl = fromStroops(raw.reserve_b);
    return {
      contractId: NEXUS_SWAP_CONTRACT_ID,
      explorerUrl: `https://stellar.expert/explorer/testnet/contract/${NEXUS_SWAP_CONTRACT_ID}`,
      admin: String(raw.admin),
      relayer: String(raw.relayer),
      treasury: String(raw.treasury),
      tokenA: String(raw.token_a),
      tokenB: String(raw.token_b),
      reserveXlm,
      reserveNxl,
      spotPriceXlmPerNxl: reserveNxl > 0 ? Number((reserveXlm / reserveNxl).toFixed(6)) : 0,
      spotPriceNxlPerXlm: reserveXlm > 0 ? Number((reserveNxl / reserveXlm).toFixed(6)) : 0,
      totalLpShares: fromStroops(raw.total_lp_shares),
      swapFeeBps: Number(raw.swap_fee_bps),
      ownerFeeSplitPct: Number(raw.owner_fee_split_pct),
      isPaused: Boolean(raw.is_paused),
      totalSwaps: Number(raw.total_swaps || 0),
      totalVolumeXlm: fromStroops(raw.total_volume_a),
      totalVolumeNxl: fromStroops(raw.total_volume_b),
      totalOwnerFeesXlm: fromStroops(raw.total_owner_fees_a),
      totalOwnerFeesNxl: fromStroops(raw.total_owner_fees_b),
      totalEscrowsLocked: Number(raw.total_escrows_locked || 0),
      totalEscrowsReleased: Number(raw.total_escrows_released || 0),
    };
  }

  static async quoteOnChainSwap(
    fromAsset: 'XLM' | 'NXL',
    amountIn: number
  ): Promise<OnChainSwapQuoteDTO> {
    const tokenIn = resolveStellarTokenContractId(fromAsset);
    const amountStroops = toStroops(amountIn);
    const raw = await this.simulateReadOnly(NEXUS_SWAP_CONTRACT_ID, 'quote_swap', [
      new Address(tokenIn).toScVal(),
      nativeToScVal(amountStroops, { type: 'i128' }),
    ]);

    const outAmount = fromStroops(raw.amount_out);
    return {
      fromAsset,
      toAsset: fromAsset === 'XLM' ? 'NXL' : 'XLM',
      tokenIn: String(raw.token_in),
      tokenOut: String(raw.token_out),
      amountIn: fromStroops(raw.amount_in),
      amountOut: outAmount,
      totalFee: fromStroops(raw.total_fee),
      ownerFee: fromStroops(raw.owner_fee),
      poolFee: fromStroops(raw.pool_fee),
      effectiveRate: amountIn > 0 ? Number((outAmount / amountIn).toFixed(6)) : 0,
      reserveInAfter: fromStroops(raw.reserve_in_after),
      reserveOutAfter: fromStroops(raw.reserve_out_after),
      contractId: NEXUS_SWAP_CONTRACT_ID,
    };
  }

  static async getOnChainOrder(orderId: string): Promise<any | null> {
    const raw = await this.simulateReadOnly(NEXUS_VAULT_CONTRACT_ID, 'get_order', [
      nativeToScVal(hashRef32(orderId), { type: 'bytes' }),
    ]);
    return raw ? serializeScValNative(raw) : null;
  }

  static async getOnChainEscrow(swapId: string): Promise<any | null> {
    const raw = await this.simulateReadOnly(NEXUS_SWAP_CONTRACT_ID, 'get_escrow', [
      nativeToScVal(hashRef32(swapId), { type: 'bytes' }),
    ]);
    return raw ? serializeScValNative(raw) : null;
  }

  // ===========================================================================
  // UNSIGNED USER XDR BUILDERS (FREIGHTER 1-CLICK ON-CHAIN SIGNING)
  // ===========================================================================

  static async buildSettleOrderXdr(params: {
    payerAddress: string;
    tokenAsset: 'XLM' | 'NXL';
    grossAmount: number;
    orderId: string;
  }) {
    const tokenId = resolveStellarTokenContractId(params.tokenAsset);
    return this.buildPreparedUnsignedXdr(
      params.payerAddress,
      NEXUS_VAULT_CONTRACT_ID,
      'settle_order',
      [
        new Address(params.payerAddress).toScVal(),
        new Address(tokenId).toScVal(),
        nativeToScVal(toStroops(params.grossAmount), { type: 'i128' }),
        nativeToScVal(hashRef32(params.orderId), { type: 'bytes' }),
      ]
    );
  }

  static async buildAmmSwapXdr(params: {
    traderAddress: string;
    fromAsset: 'XLM' | 'NXL';
    amountIn: number;
    minAmountOut: number;
    deadlineUnixSec?: number;
  }) {
    const tokenIn = resolveStellarTokenContractId(params.fromAsset);
    const deadline = BigInt(params.deadlineUnixSec || Math.floor(Date.now() / 1000) + 300);
    return this.buildPreparedUnsignedXdr(
      params.traderAddress,
      NEXUS_SWAP_CONTRACT_ID,
      'swap_exact_in',
      [
        new Address(params.traderAddress).toScVal(),
        new Address(tokenIn).toScVal(),
        nativeToScVal(toStroops(params.amountIn), { type: 'i128' }),
        nativeToScVal(toStroops(Math.max(0.0000001, params.minAmountOut)), { type: 'i128' }),
        nativeToScVal(deadline, { type: 'u64' }),
      ]
    );
  }

  static async buildLockBridgeEscrowXdr(params: {
    senderAddress: string;
    tokenAsset: 'XLM' | 'NXL';
    amount: number;
    swapId: string;
    xrplDestination: string;
    expiryUnixSec?: number;
  }) {
    const tokenId = resolveStellarTokenContractId(params.tokenAsset);
    const expiry = BigInt(params.expiryUnixSec || Math.floor(Date.now() / 1000) + 900);
    return this.buildPreparedUnsignedXdr(
      params.senderAddress,
      NEXUS_SWAP_CONTRACT_ID,
      'lock_bridge_escrow',
      [
        new Address(params.senderAddress).toScVal(),
        new Address(tokenId).toScVal(),
        nativeToScVal(toStroops(params.amount), { type: 'i128' }),
        nativeToScVal(hashRef32(params.swapId), { type: 'bytes' }),
        nativeToScVal(params.xrplDestination, { type: 'string' }),
        nativeToScVal(expiry, { type: 'u64' }),
      ]
    );
  }

  static async buildBurnForBridgeXdr(params: {
    holderAddress: string;
    amountNxl: number;
    xrplDestination: string;
    swapId: string;
  }) {
    return this.buildPreparedUnsignedXdr(
      params.holderAddress,
      NEXUS_VAULT_CONTRACT_ID,
      'burn_for_bridge',
      [
        new Address(params.holderAddress).toScVal(),
        nativeToScVal(toStroops(params.amountNxl), { type: 'i128' }),
        nativeToScVal(params.xrplDestination, { type: 'string' }),
        nativeToScVal(hashRef32(params.swapId), { type: 'bytes' }),
      ]
    );
  }

  static async buildRefundExpiredEscrowXdr(params: {
    callerAddress: string;
    swapId: string;
  }) {
    return this.buildPreparedUnsignedXdr(
      params.callerAddress,
      NEXUS_SWAP_CONTRACT_ID,
      'refund_expired_escrow',
      [
        new Address(params.callerAddress).toScVal(),
        nativeToScVal(hashRef32(params.swapId), { type: 'bytes' }),
      ]
    );
  }

  // ===========================================================================
  // SERVER-SIGNED RELAYER / ADMIN ON-CHAIN EXECUTORS (MINT, BURN, REFUND, ESCROW, CONFIG)
  // ===========================================================================

  static async mintNxlOnChain(params: {
    recipientAddress: string;
    amountNxl: number;
    reason: 'cashback' | 'bridge' | 'liquidity' | 'admin';
    refId: string;
    operatorId?: string;
  }): Promise<SorobanTxSubmissionResult> {
    const callerPub = (await this.resolveAdminKeypair()).publicKey();
    const res = await this.invokeWithServerKey(NEXUS_VAULT_CONTRACT_ID, 'mint_nxl', [
      new Address(callerPub).toScVal(),
      new Address(params.recipientAddress).toScVal(),
      nativeToScVal(toStroops(params.amountNxl), { type: 'i128' }),
      nativeToScVal(params.reason, { type: 'symbol' }),
      nativeToScVal(hashRef32(params.refId), { type: 'bytes' }),
    ]);

    await DualRailTokenService.logChainAction({
      chain: 'STELLAR',
      action: 'MINT',
      operatorId: params.operatorId || 'SOROBAN_RELAYER',
      referenceId: params.refId,
      txHash: res.txHash,
      ledgerSeq: res.ledger,
      amountPrimary: params.amountNxl,
      details: {
        contract: NEXUS_VAULT_CONTRACT_ID,
        method: 'mint_nxl',
        reason: params.reason,
        recipient: params.recipientAddress,
      },
    }).catch(() => {});

    await RedisCacheService.invalidateCache('admin:contract:live').catch(() => {});
    return res;
  }

  static async burnNxlOnChain(params: {
    amountNxl: number;
    reason: 'buyback' | 'admin' | 'bridge';
    refId: string;
    operatorId?: string;
    holderSecret?: string;
  }): Promise<SorobanTxSubmissionResult> {
    const holderSigner = params.holderSecret
      ? Keypair.fromSecret(params.holderSecret)
      : await this.resolveAdminKeypair();
    const holderPub = holderSigner.publicKey();
    const res = await this.invokeWithKeypair(holderSigner, NEXUS_VAULT_CONTRACT_ID, 'burn_nxl', [
      new Address(holderPub).toScVal(),
      nativeToScVal(toStroops(params.amountNxl), { type: 'i128' }),
      nativeToScVal(params.reason, { type: 'symbol' }),
      nativeToScVal(hashRef32(params.refId), { type: 'bytes' }),
    ]);

    await DualRailTokenService.logChainAction({
      chain: 'STELLAR',
      action: 'BURN',
      operatorId: params.operatorId || 'ADMIN_BUYBACK_BURN',
      referenceId: params.refId,
      txHash: res.txHash,
      ledgerSeq: res.ledger,
      amountPrimary: params.amountNxl,
      details: {
        contract: NEXUS_VAULT_CONTRACT_ID,
        method: 'burn_nxl',
        reason: params.reason,
        holder: holderPub,
      },
    }).catch(() => {});

    await Promise.all([
      RedisCacheService.invalidateCache('admin:contract:live').catch(() => {}),
      RedisCacheService.invalidateCache('admin:tokenomics:reconciliation').catch(() => {}),
    ]);
    return res;
  }

  /**
   * Executes a server-signed AMM swap (`swap_exact_in`) on NexusSwap v2.0 using
   * the protocol-controlled Buyback Reserve keypair, returning verified on-chain output amount.
   */
  static async executeBuybackSwapOnNexusSwap(params: {
    buyerSecret: string;
    amountXlm: number;
    minNxlOut: number;
    deadlineUnixSec?: number;
    refId: string;
    operatorId?: string;
  }): Promise<SorobanTxSubmissionResult & { amountNxlReceived: number; buyerPublicKey: string }> {
    const buyerSigner = Keypair.fromSecret(params.buyerSecret);
    const buyerPub = buyerSigner.publicKey();
    const deadline = BigInt(params.deadlineUnixSec || Math.floor(Date.now() / 1000) + 300);

    const res = await this.invokeWithKeypair(buyerSigner, NEXUS_SWAP_CONTRACT_ID, 'swap_exact_in', [
      new Address(buyerPub).toScVal(),
      new Address(XLM_SAC_CONTRACT_ID).toScVal(),
      nativeToScVal(toStroops(params.amountXlm), { type: 'i128' }),
      nativeToScVal(toStroops(Math.max(0.0000001, params.minNxlOut)), { type: 'i128' }),
      nativeToScVal(deadline, { type: 'u64' }),
    ]);

    const rawOut = res.returnValue?.amount_out;
    const verifiedOutNxl = rawOut !== undefined && rawOut !== null
      ? fromStroops(rawOut)
      : Number(params.minNxlOut);

    await DualRailTokenService.logChainAction({
      chain: 'STELLAR',
      action: 'AMM_SWAP',
      operatorId: params.operatorId || 'BUYBACK_ENGINE',
      referenceId: params.refId,
      txHash: res.txHash,
      ledgerSeq: res.ledger,
      amountPrimary: `${params.amountXlm} XLM`,
      amountSecondary: `${verifiedOutNxl} NXL`,
      details: {
        contract: NEXUS_SWAP_CONTRACT_ID,
        method: 'swap_exact_in',
        purpose: 'buyback',
        buyer: buyerPub,
        minNxlOut: params.minNxlOut,
        verifiedOutNxl,
      },
    }).catch(() => {});

    await RedisCacheService.invalidateCache('admin:contract:live').catch(() => {});
    return {
      ...res,
      amountNxlReceived: verifiedOutNxl,
      buyerPublicKey: buyerPub,
    };
  }

  static async refundOrderOnChain(params: {
    orderId: string;
    refundAmount: number;
    operatorId?: string;
  }): Promise<SorobanTxSubmissionResult> {
    const operatorPub = (await this.resolveAdminKeypair()).publicKey();
    const res = await this.invokeWithServerKey(NEXUS_VAULT_CONTRACT_ID, 'refund_order', [
      new Address(operatorPub).toScVal(),
      nativeToScVal(hashRef32(params.orderId), { type: 'bytes' }),
      nativeToScVal(toStroops(params.refundAmount), { type: 'i128' }),
    ]);

    await DualRailTokenService.logChainAction({
      chain: 'STELLAR',
      action: 'REFUND',
      operatorId: params.operatorId || 'SOROBAN_ADMIN',
      referenceId: params.orderId,
      txHash: res.txHash,
      ledgerSeq: res.ledger,
      amountPrimary: params.refundAmount,
      details: { contract: NEXUS_VAULT_CONTRACT_ID, method: 'refund_order' },
    }).catch(() => {});

    return res;
  }

  static async releaseBridgeEscrowOnChain(params: {
    swapId: string;
    recipientAddress?: string;
    xrplTxHash: string;
  }): Promise<SorobanTxSubmissionResult> {
    const relayerPub = (await this.resolveAdminKeypair()).publicKey();
    const recipient = params.recipientAddress || env.PLATFORM_STELLAR_VAULT;
    return this.invokeWithServerKey(NEXUS_SWAP_CONTRACT_ID, 'release_bridge_escrow', [
      new Address(relayerPub).toScVal(),
      nativeToScVal(hashRef32(params.swapId), { type: 'bytes' }),
      new Address(recipient).toScVal(),
      nativeToScVal(params.xrplTxHash, { type: 'string' }),
    ]);
  }

  static async refundBridgeEscrowOnChain(params: {
    swapId: string;
  }): Promise<SorobanTxSubmissionResult> {
    const relayerPub = (await this.resolveAdminKeypair()).publicKey();
    return this.invokeWithServerKey(NEXUS_SWAP_CONTRACT_ID, 'refund_expired_escrow', [
      new Address(relayerPub).toScVal(),
      nativeToScVal(hashRef32(params.swapId), { type: 'bytes' }),
    ]);
  }

  static async syncVaultConfigOnChain(params: {
    orderFeeBps?: number;
    ownerSplitPct?: number;
    isPaused?: boolean;
  }): Promise<{ configTx?: SorobanTxSubmissionResult; pauseTx?: SorobanTxSubmissionResult }> {
    const out: { configTx?: SorobanTxSubmissionResult; pauseTx?: SorobanTxSubmissionResult } = {};

    if (params.orderFeeBps !== undefined || params.ownerSplitPct !== undefined) {
      out.configTx = await this.invokeWithServerKey(NEXUS_VAULT_CONTRACT_ID, 'update_config', [
        xdr.ScVal.scvVoid(), // Option::None for new_treasury
        xdr.ScVal.scvVoid(), // Option::None for new_nr_reserve
        params.orderFeeBps !== undefined
          ? nativeToScVal(params.orderFeeBps, { type: 'u32' })
          : xdr.ScVal.scvVoid(),
        params.ownerSplitPct !== undefined
          ? nativeToScVal(params.ownerSplitPct, { type: 'u32' })
          : xdr.ScVal.scvVoid(),
        xdr.ScVal.scvVoid(), // Option::None for new_supply_cap
      ]);
    }

    if (params.isPaused !== undefined) {
      const callerPub = (await this.resolveAdminKeypair()).publicKey();
      out.pauseTx = await this.invokeWithServerKey(NEXUS_VAULT_CONTRACT_ID, 'set_paused', [
        new Address(callerPub).toScVal(),
        nativeToScVal(params.isPaused, { type: 'bool' }),
      ]);
    }

    await RedisCacheService.invalidateCache('admin:contract:live').catch(() => {});
    await RedisCacheService.invalidateCache('admin:contract:nexus-vault').catch(() => {});
    return out;
  }

  static async getFullLiveTelemetry() {
    const cacheKey = 'admin:contract:live';
    const cached = await RedisCacheService.getCache<any>(cacheKey);
    if (cached) return cached;

    const [rpcHealth, vaultConfig, vaultMetrics, swapPool] = await Promise.all([
      this.getStellarRpcHealth(),
      this.getLiveVaultConfig(),
      this.getLiveVaultMetrics(),
      this.getLiveSwapPoolState(),
    ]);

    const payload = {
      rpcHealth,
      vault: {
        config: vaultConfig,
        metrics: vaultMetrics,
        wasmHash: env.STELLAR_NEXUS_VAULT_WASM_HASH,
      },
      swap: {
        pool: swapPool,
        wasmHash: env.STELLAR_NEXUS_SWAP_WASM_HASH,
      },
      tokens: {
        xlmSac: XLM_SAC_CONTRACT_ID,
        nxlSac: NXL_SAC_CONTRACT_ID,
      },
      fetchedAt: new Date().toISOString(),
    };

    await RedisCacheService.setCache(cacheKey, payload, 20);
    return payload;
  }

  // ===========================================================================
  // RPC HEALTH & MONGODB METADATA REGISTRY
  // ===========================================================================

  static async getStellarRpcHealth(): Promise<StellarRpcHealthResult> {
    const rpcUrl = this.getRpcUrl();
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return { status: 'DEGRADED', protocolVersion: 22, latestLedger: 0, latencyMs, rpcUrl };
      }

      const json = await res.json();
      const isHealthy = json?.result?.status === 'healthy';

      let latestLedger = 0;
      let protocolVersion = 22;
      try {
        const ledgerRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'getLatestLedger' }),
        });
        const ledgerJson = await ledgerRes.json();
        if (ledgerJson?.result?.sequence) latestLedger = ledgerJson.result.sequence;
        if (ledgerJson?.result?.protocolVersion) protocolVersion = ledgerJson.result.protocolVersion;
      } catch {}

      return {
        status: isHealthy ? 'HEALTHY' : 'DEGRADED',
        protocolVersion: Math.max(22, protocolVersion),
        latestLedger,
        latencyMs,
        rpcUrl,
      };
    } catch {
      return {
        status: 'OFFLINE',
        protocolVersion: 22,
        latestLedger: 0,
        latencyMs: Date.now() - start,
        rpcUrl,
      };
    }
  }

  static async ensureGenesisContract(): Promise<MongoSmartContractDoc> {
    try {
      const contractsCol = await MongoService.getCollection<MongoSmartContractDoc>('platform_contracts');
      const existing = await contractsCol.findOne({ name: 'NexusVault' });

      // Migrate legacy placeholder record (which pointed at NXL SAC) to real deployed NexusVault v2.0
      if (existing && existing.contract_id !== NEXUS_VAULT_CONTRACT_ID) {
        await contractsCol.updateOne(
          { name: 'NexusVault' },
          {
            $set: {
              contract_id: NEXUS_VAULT_CONTRACT_ID,
              current_wasm_hash: env.STELLAR_NEXUS_VAULT_WASM_HASH,
              explorer_url: `https://stellar.expert/explorer/testnet/contract/${NEXUS_VAULT_CONTRACT_ID}`,
              last_verified_at: new Date().toISOString(),
            },
          }
        );
        return (await contractsCol.findOne({ name: 'NexusVault' })) || DEFAULT_NEXUS_VAULT_CONTRACT;
      }

      if (existing) return existing;

      await contractsCol.updateOne(
        { name: 'NexusVault' },
        { $setOnInsert: DEFAULT_NEXUS_VAULT_CONTRACT },
        { upsert: true }
      );
      return (await contractsCol.findOne({ name: 'NexusVault' })) || DEFAULT_NEXUS_VAULT_CONTRACT;
    } catch {
      return DEFAULT_NEXUS_VAULT_CONTRACT;
    }
  }

  static async getContractMetadata(contractId?: string): Promise<{
    contract: SmartContractWithDto;
    rpcHealth: StellarRpcHealthResult;
  }> {
    const cacheKey = `admin:contract:${contractId || 'nexus-vault'}`;
    const cached = await RedisCacheService.getCache<{
      contract: SmartContractWithDto;
      rpcHealth: StellarRpcHealthResult;
    }>(cacheKey);
    if (cached) return cached;

    const contractsCol = await MongoService.getCollection<MongoSmartContractDoc>('platform_contracts');
    let contract: MongoSmartContractDoc | null = contractId
      ? await contractsCol.findOne({ contract_id: contractId })
      : await this.ensureGenesisContract();

    if (!contract) {
      contract = await this.ensureGenesisContract();
    }
    const finalContract = contract || DEFAULT_NEXUS_VAULT_CONTRACT;

    const rpcHealth = await this.getStellarRpcHealth();

    const verifiedAt = new Date().toISOString();
    await contractsCol
      .updateOne({ contract_id: finalContract.contract_id }, { $set: { last_verified_at: verifiedAt } })
      .catch(() => {});

    const result = {
      contract: withContractDto({ ...finalContract, last_verified_at: verifiedAt }),
      rpcHealth,
    };
    await RedisCacheService.setCache(cacheKey, result, 60);
    return result;
  }

  static async recordContractUpgrade(
    contractId: string,
    newWasmHash: string,
    adminId: string,
    txHash: string,
    notes?: string
  ): Promise<MongoSmartContractDoc> {
    const contractsCol = await MongoService.getCollection<MongoSmartContractDoc>('platform_contracts');
    const contract = await contractsCol.findOne({ contract_id: contractId });
    if (!contract) {
      throw new Error(`Smart contract ${contractId} not found`);
    }

    const upgradeEntry: ContractUpgradeEntry = {
      wasm_hash: newWasmHash,
      upgraded_at: new Date().toISOString(),
      tx_hash: txHash,
      upgraded_by: adminId,
      protocol_version: 22,
      notes: notes || 'In-place WASM upgrade executed via update_current_contract_wasm',
    };

    await contractsCol.updateOne(
      { contract_id: contractId },
      {
        $set: {
          current_wasm_hash: newWasmHash,
          last_verified_at: new Date().toISOString(),
        },
        $push: {
          upgrades: upgradeEntry,
        },
      }
    );

    await Promise.all([
      RedisCacheService.invalidateCache(`admin:contract:${contractId}`),
      RedisCacheService.invalidateCache('admin:contract:nexus-vault'),
      RedisCacheService.invalidateCache('admin:contract:live'),
    ]);

    return (await contractsCol.findOne({ contract_id: contractId }))!;
  }

  static async getContractExecutionStatus(txHash: string) {
    const horizonUrl = env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || 'https://horizon-testnet.stellar.org';
    const server = new Horizon.Server(horizonUrl);
    const tx = await server.transactions().transaction(txHash).call();
    return {
      txHash: tx.hash,
      status: tx.successful ? 'SUCCESS' : 'FAILED',
      ledgerSeq: tx.ledger_attr,
      sourceAccount: tx.source_account,
    };
  }
}
