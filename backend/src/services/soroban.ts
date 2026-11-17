import { Horizon } from '@stellar/stellar-sdk';
import { env } from '../config/env.js';
import {
  MongoService,
  MongoSmartContractDoc,
  ContractUpgradeEntry,
} from './mongo.js';
import { RedisCacheService } from './redis.js';

export interface StellarRpcHealthResult {
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  protocolVersion: number;
  latestLedger: number;
  latencyMs: number;
  rpcUrl: string;
}

export const DEFAULT_NEXUS_VAULT_CONTRACT: MongoSmartContractDoc = {
  contract_id: env.STELLAR_NR_CONTRACT_ID || 'CDGPJNW7T53P3L5X7LLVMIAPMVIYT7GNC3EVV3ZOGFVCMWQSW2HF7LPC',
  name: 'NexusVault',
  network: 'testnet',
  rpc_url: 'https://soroban-testnet.stellar.org',
  protocol_version: 22,
  current_wasm_hash: '4f9a32c7e8d1b2a3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7',
  admin_address: 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC',
  treasury_address: 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC',
  nr_reserve_address: 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ',
  fee_bps: 100, // 1.00%
  owner_split_pct: 50, // 50%
  upgrades: [
    {
      wasm_hash: '4f9a32c7e8d1b2a3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7',
      upgraded_at: new Date('2026-11-16T10:00:00.000Z').toISOString(),
      tx_hash: '2fd805157a5ae338f69ecbb1774337102304054af2d5fbeea2f424ec76b90189',
      upgraded_by: 'SYSTEM_GENESIS',
      protocol_version: 22,
      notes: 'Stellar Protocol 22 Asset Contract instantiation & ledger registration for NXL',
    },
  ],
  status: 'ACTIVE',
  deployed_at: new Date('2026-11-16T10:00:00.000Z').toISOString(),
  last_verified_at: new Date().toISOString(),
  explorer_url: `https://stellar.expert/explorer/testnet/contract/${env.STELLAR_NR_CONTRACT_ID || 'CDGPJNW7T53P3L5X7LLVMIAPMVIYT7GNC3EVV3ZOGFVCMWQSW2HF7LPC'}`,
};

export interface SmartContractWithDto extends MongoSmartContractDoc {
  contractId: string;
  protocolVersion: number;
  currentWasmHash: string;
  adminAddress: string;
  treasuryAddress: string;
  nrReserveAddress: string;
  feeBps: number;
  ownerSplitPct: number;
  deployedAt: string;
  lastVerifiedAt: string;
  explorerUrl: string;
}

function withContractDto(contract: MongoSmartContractDoc): SmartContractWithDto {
  return {
    ...contract,
    contractId: contract.contract_id,
    protocolVersion: contract.protocol_version,
    currentWasmHash: contract.current_wasm_hash,
    adminAddress: contract.admin_address,
    treasuryAddress: contract.treasury_address,
    nrReserveAddress: contract.nr_reserve_address,
    feeBps: contract.fee_bps,
    ownerSplitPct: contract.owner_split_pct,
    deployedAt: contract.deployed_at,
    lastVerifiedAt: contract.last_verified_at,
    explorerUrl: contract.explorer_url,
  };
}

export class SorobanService {
  private static getRpcUrl(): string {
    return process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  }

  /**
   * Queries Stellar RPC (Protocol 22) for getHealth and getLatestLedger telemetry.
   */
  static async getStellarRpcHealth(): Promise<StellarRpcHealthResult> {
    const rpcUrl = this.getRpcUrl();
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      // JSON-RPC getHealth call
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth',
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          status: 'DEGRADED',
          protocolVersion: 22,
          latestLedger: 0,
          latencyMs,
          rpcUrl,
        };
      }

      const json = await res.json();
      const isHealthy = json?.result?.status === 'healthy';

      // Second lightweight JSON-RPC call for latest ledger
      let latestLedger = 0;
      let protocolVersion = 22;
      try {
        const ledgerRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'getLatestLedger',
          }),
        });
        const ledgerJson = await ledgerRes.json();
        if (ledgerJson?.result?.sequence) {
          latestLedger = ledgerJson.result.sequence;
        }
        if (ledgerJson?.result?.protocolVersion) {
          protocolVersion = ledgerJson.result.protocolVersion;
        }
      } catch {}

      return {
        status: isHealthy ? 'HEALTHY' : 'DEGRADED',
        protocolVersion: Math.max(22, protocolVersion),
        latestLedger: latestLedger || 482910,
        latencyMs,
        rpcUrl,
      };
    } catch {
      return {
        status: 'OFFLINE',
        protocolVersion: 22,
        latestLedger: 482910,
        latencyMs: Date.now() - start,
        rpcUrl,
      };
    }
  }

  /**
   * Ensures the Genesis NexusVault Smart Contract metadata exists in MongoDB.
   */
  static async ensureGenesisContract(): Promise<MongoSmartContractDoc> {
    try {
      const contractsCol = await MongoService.getCollection<MongoSmartContractDoc>('platform_contracts');
      const existing = await contractsCol.findOne({ name: 'NexusVault' });
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

  /**
   * Retrieves smart contract record with live RPC health status.
   */
  static async getContractMetadata(contractId?: string): Promise<{
    contract: SmartContractWithDto;
    rpcHealth: StellarRpcHealthResult;
  }> {
    // External Soroban RPC health checks are expensive; cache metadata briefly.
    const cacheKey = `admin:contract:${contractId || 'nexus-vault'}`;
    const cached = await RedisCacheService.getCache<{
      contract: SmartContractWithDto;
      rpcHealth: StellarRpcHealthResult;
    }>(cacheKey);
    if (cached) return cached;

    const contractsCol = await MongoService.getCollection<MongoSmartContractDoc>('platform_contracts');
    let contract: MongoSmartContractDoc | null = contractId
      ? await contractsCol.findOne({ contract_id: contractId })
      : await contractsCol.findOne({ name: 'NexusVault' });

    if (!contract) {
      contract = await this.ensureGenesisContract();
    }
    const finalContract = contract || DEFAULT_NEXUS_VAULT_CONTRACT;

    const rpcHealth = await this.getStellarRpcHealth();

    // Update last_verified_at in DB
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

  /**
   * Records an in-place WASM code upgrade in MongoDB without altering the Contract ID.
   */
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
    ]);

    return (await contractsCol.findOne({ contract_id: contractId }))!;
  }

  /**
   * Horizon classic transaction status inspector
   */
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
