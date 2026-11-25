import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { PlatformSettingsService } from '../services/platformSettings.service.js';
import { TreasuryService } from '../services/treasury.service.js';

export class PlatformController {
  /**
   * GET /api/v1/platform/config
   *
   * Dynamic, database-driven platform configuration. Exposes non-sensitive
   * platform parameters: active network mode (testnet/mainnet), dynamic fee
   * policies, contract IDs, RPC endpoints, and explorer URLs.
   */
  static async getConfig(_req: Request, res: Response): Promise<void> {
    try {
      const [pubConfig, treasuryConfig] = await Promise.all([
        PlatformSettingsService.getPublicConfig(),
        TreasuryService.getConfig().catch(() => null),
      ]);

      res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
      res.json({
        success: true,
        data: {
          environment: env.NODE_ENV,
          network: pubConfig.environment,
          isTestnet: pubConfig.isTestnet,
          assets: {
            nxl: {
              stellarCode: pubConfig.stellar.nxlAssetCode,
              stellarIssuer: pubConfig.stellar.nxlIssuerPublic,
              stellarContractId: pubConfig.stellar.nxlContractId,
              xrplCurrency: pubConfig.xrpl.nxlCurrencyCode,
              xrplCurrencyHex: pubConfig.xrpl.nxlCurrencyHex,
              xrplIssuer: pubConfig.xrpl.nxlIssuerAddress,
              xrplAmmAccount: pubConfig.xrpl.nxlAmmAccount,
            },
          },
          vaults: {
            stellar: pubConfig.stellar.merchantVault,
            xrpl: pubConfig.xrpl.merchantVault,
            stellarDistributor: pubConfig.stellar.distributorVault,
            xrplDistributor: pubConfig.xrpl.distributorVault,
          },
          contracts: {
            nexusVault: pubConfig.stellar.nexusVaultContractId,
            nexusSwap: pubConfig.stellar.nexusSwapContractId,
            xlmSac: pubConfig.stellar.xlmSacContractId,
          },
          networks: {
            stellarPassphrase: pubConfig.stellar.networkPassphrase,
            stellarHorizon: pubConfig.stellar.horizonUrl,
            stellarRpc: pubConfig.stellar.rpcUrl,
            xrplWss: pubConfig.xrpl.wss,
          },
          fees: {
            orderFeeBps: pubConfig.fees.platformOrderFeeBps,
            swapSpreadBps: pubConfig.fees.swapFeeBps,
            cashoutSpreadBps: pubConfig.fees.cashoutSpreadBps,
            slippageToleranceBps: pubConfig.fees.slippageToleranceBps,
            cashbackPct: pubConfig.fees.cashbackPercent,
            nxlCheckoutDiscountPct: pubConfig.fees.nxlDiscountPercent,
            aiFeeBps: treasuryConfig?.ai_fee_bps ?? 25,
            gasFlatCents: treasuryConfig?.gas_flat_cents ?? 10,
            nrBuybackSharePct: treasuryConfig?.nr_buyback_share_pct ?? 50,
            isPaused: treasuryConfig?.is_paused ?? false,
          },
          explorers: {
            stellarTx: pubConfig.stellar.explorerTxBase,
            stellarBase: pubConfig.stellar.explorerBase,
            stellarAccount: pubConfig.stellar.explorerAccountBase,
            stellarContract: pubConfig.stellar.explorerContractBase,
            xrplTx: pubConfig.xrpl.explorerTxBase,
            xrplBase: pubConfig.xrpl.explorerBase,
            xrplAccount: pubConfig.xrpl.explorerAccountBase,
          },
          updatedAt: pubConfig.updatedAt,
        },
      });
    } catch (error: any) {
      res.status(503).json({
        success: false,
        error: error?.message || 'Platform configuration is unavailable',
      });
    }
  }
}
