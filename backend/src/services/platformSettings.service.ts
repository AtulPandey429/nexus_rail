import { MongoService, type MongoPlatformSettingsDoc } from './mongo.js';
import { RedisCacheService } from './redis.js';
import {
  STELLAR_TESTNET,
  STELLAR_MAINNET,
  XRPL_TESTNET,
  XRPL_MAINNET,
  type NetworkEnvironment,
} from '../utils/constants.js';

export const DEFAULT_PLATFORM_SETTINGS: Omit<MongoPlatformSettingsDoc, '_id'> = {
  id: 'global_platform_settings',
  network_mode: 'testnet',
  fees: {
    swap_fee_bps: 30, // 0.30%
    platform_order_fee_bps: 100, // 1.00%
    cashback_rate_bps: 200, // 2.00% (Unified with TreasuryService & CouponService)
    slippage_tolerance_bps: 150, // 1.50%
    cashout_spread_bps: 50, // 0.50%
    nxl_discount_bps: 1000, // 10.00%
  },
  stellar: {
    networkPassphrase: STELLAR_TESTNET.networkPassphrase,
    horizonUrl: STELLAR_TESTNET.horizonUrl,
    rpcUrl: STELLAR_TESTNET.rpcUrl,
    merchantVault: STELLAR_TESTNET.merchantVault,
    distributorVault: STELLAR_TESTNET.distributorVault,
    nxlAssetCode: STELLAR_TESTNET.nxlAssetCode,
    nxlIssuerPublic: STELLAR_TESTNET.nxlIssuerPublic,
    nxlContractId: STELLAR_TESTNET.nxlContractId,
    nexusVaultContractId: STELLAR_TESTNET.nexusVaultContractId,
    nexusSwapContractId: STELLAR_TESTNET.nexusSwapContractId,
    xlmSacContractId: STELLAR_TESTNET.xlmSacContractId,
    explorerBase: STELLAR_TESTNET.explorerBase,
    explorerTxBase: STELLAR_TESTNET.explorerTxBase,
    explorerAccountBase: STELLAR_TESTNET.explorerAccountBase,
    explorerContractBase: STELLAR_TESTNET.explorerContractBase,
  },
  xrpl: {
    wss: XRPL_TESTNET.wss,
    merchantVault: XRPL_TESTNET.merchantVault,
    distributorVault: XRPL_TESTNET.distributorVault,
    nxlCurrencyCode: XRPL_TESTNET.nxlCurrencyCode,
    nxlCurrencyHex: XRPL_TESTNET.nxlCurrencyHex,
    nxlIssuerAddress: XRPL_TESTNET.nxlIssuerAddress,
    nxlAmmAccount: XRPL_TESTNET.nxlAmmAccount,
    explorerBase: XRPL_TESTNET.explorerBase,
    explorerTxBase: XRPL_TESTNET.explorerTxBase,
    explorerAccountBase: XRPL_TESTNET.explorerAccountBase,
  },
  updated_at: new Date().toISOString(),
};

// In-memory micro-cache
let cachedSettings: MongoPlatformSettingsDoc | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5000;

export class PlatformSettingsService {
  private static readonly CACHE_KEY = 'platform:global_settings';

  /**
   * Retrieves the global platform settings from MongoDB Atlas with caching.
   * Auto-seeds defaults if uninitialized.
   */
  static async getSettings(): Promise<MongoPlatformSettingsDoc> {
    const now = Date.now();
    if (cachedSettings && now < cacheExpiry) {
      return cachedSettings;
    }

    try {
      // 1. Try Redis cache
      const cached = await RedisCacheService.getCache<{ doc: MongoPlatformSettingsDoc }>(this.CACHE_KEY);
      if (cached?.doc) {
        cachedSettings = cached.doc;
        cacheExpiry = now + CACHE_TTL_MS;
        return cached.doc;
      }

      // 2. Query MongoDB
      const col = await MongoService.getCollection<MongoPlatformSettingsDoc>('platform_settings');
      let doc = await col.findOne({ id: 'global_platform_settings' });

      if (!doc) {
        // Auto-seed default singleton
        const initialDoc: MongoPlatformSettingsDoc = {
          ...DEFAULT_PLATFORM_SETTINGS,
          updated_at: new Date().toISOString(),
        };
        await col.updateOne(
          { id: 'global_platform_settings' },
          { $setOnInsert: initialDoc },
          { upsert: true }
        );
        doc = await col.findOne({ id: 'global_platform_settings' });
      }

      const finalDoc = doc || { ...DEFAULT_PLATFORM_SETTINGS };
      cachedSettings = finalDoc;
      cacheExpiry = now + CACHE_TTL_MS;

      // Cache in Redis for 10 seconds
      await RedisCacheService.setCache(this.CACHE_KEY, { doc: finalDoc }, 10).catch(() => {});

      return finalDoc;
    } catch (err: any) {
      console.warn('⚠️ [PlatformSettingsService] Database lookup warning, using in-memory defaults:', err.message);
      return cachedSettings || { ...DEFAULT_PLATFORM_SETTINGS };
    }
  }

  /**
   * Updates platform settings (Admin-only).
   */
  static async updateSettings(
    updates: Partial<Omit<MongoPlatformSettingsDoc, '_id' | 'id'>>,
    adminId?: string
  ): Promise<MongoPlatformSettingsDoc> {
    const col = await MongoService.getCollection<MongoPlatformSettingsDoc>('platform_settings');
    const now = new Date().toISOString();

    const current = await this.getSettings();

    // Deep merge updates
    const mergedDoc: MongoPlatformSettingsDoc = {
      ...current,
      ...updates,
      fees: {
        ...current.fees,
        ...(updates.fees || {}),
      },
      stellar: {
        ...current.stellar,
        ...(updates.stellar || {}),
      },
      xrpl: {
        ...current.xrpl,
        ...(updates.xrpl || {}),
      },
      updated_at: now,
      updated_by: adminId || 'admin',
    };

    // If admin switched network mode, apply default network template if URLs weren't explicitly overridden
    if (updates.network_mode && updates.network_mode !== current.network_mode) {
      if (updates.network_mode === 'mainnet') {
        if (!updates.stellar?.horizonUrl) mergedDoc.stellar.horizonUrl = STELLAR_MAINNET.horizonUrl;
        if (!updates.stellar?.rpcUrl) mergedDoc.stellar.rpcUrl = STELLAR_MAINNET.rpcUrl;
        if (!updates.stellar?.networkPassphrase) mergedDoc.stellar.networkPassphrase = STELLAR_MAINNET.networkPassphrase;
        if (!updates.xrpl?.wss) mergedDoc.xrpl.wss = XRPL_MAINNET.wss;
      } else {
        if (!updates.stellar?.horizonUrl) mergedDoc.stellar.horizonUrl = STELLAR_TESTNET.horizonUrl;
        if (!updates.stellar?.rpcUrl) mergedDoc.stellar.rpcUrl = STELLAR_TESTNET.rpcUrl;
        if (!updates.stellar?.networkPassphrase) mergedDoc.stellar.networkPassphrase = STELLAR_TESTNET.networkPassphrase;
        if (!updates.xrpl?.wss) mergedDoc.xrpl.wss = XRPL_TESTNET.wss;
      }
    }

    await col.updateOne(
      { id: 'global_platform_settings' },
      { $set: mergedDoc },
      { upsert: true }
    );

    // Invalidate caches immediately
    cachedSettings = null;
    cacheExpiry = 0;
    await RedisCacheService.invalidateCache(this.CACHE_KEY).catch(() => {});
    await RedisCacheService.invalidateCache('platform:config').catch(() => {});

    return mergedDoc;
  }

  /**
   * Returns active platform fees.
   */
  static async getFees() {
    const settings = await this.getSettings();
    return settings.fees;
  }

  /**
   * Returns active network mode ('testnet' | 'mainnet').
   */
  static async getActiveNetworkMode(): Promise<NetworkEnvironment> {
    const settings = await this.getSettings();
    return settings.network_mode || 'testnet';
  }

  /**
   * Returns safe public platform config for frontend consumption.
   */
  static async getPublicConfig() {
    const settings = await this.getSettings();
    const isTestnet = settings.network_mode === 'testnet';

    return {
      environment: settings.network_mode,
      isTestnet,
      fees: {
        swapFeeBps: settings.fees.swap_fee_bps,
        swapFeePercent: settings.fees.swap_fee_bps / 100,
        platformOrderFeeBps: settings.fees.platform_order_fee_bps,
        cashbackRateBps: settings.fees.cashback_rate_bps,
        cashbackPercent: settings.fees.cashback_rate_bps / 100,
        slippageToleranceBps: settings.fees.slippage_tolerance_bps,
        cashoutSpreadBps: settings.fees.cashout_spread_bps,
        nxlDiscountPercent: settings.fees.nxl_discount_bps / 100,
      },
      stellar: {
        network: settings.network_mode,
        networkPassphrase: settings.stellar.networkPassphrase,
        horizonUrl: settings.stellar.horizonUrl,
        rpcUrl: settings.stellar.rpcUrl,
        merchantVault: settings.stellar.merchantVault,
        distributorVault: settings.stellar.distributorVault,
        nxlAssetCode: settings.stellar.nxlAssetCode,
        nxlIssuerPublic: settings.stellar.nxlIssuerPublic,
        nxlContractId: settings.stellar.nxlContractId,
        nexusVaultContractId: settings.stellar.nexusVaultContractId,
        nexusSwapContractId: settings.stellar.nexusSwapContractId,
        xlmSacContractId: settings.stellar.xlmSacContractId,
        explorerBase: settings.stellar.explorerBase,
        explorerTxBase: settings.stellar.explorerTxBase,
        explorerAccountBase: settings.stellar.explorerAccountBase,
        explorerContractBase: settings.stellar.explorerContractBase,
      },
      xrpl: {
        network: settings.network_mode,
        wss: settings.xrpl.wss,
        merchantVault: settings.xrpl.merchantVault,
        distributorVault: settings.xrpl.distributorVault,
        nxlCurrencyCode: settings.xrpl.nxlCurrencyCode,
        nxlCurrencyHex: settings.xrpl.nxlCurrencyHex,
        nxlIssuerAddress: settings.xrpl.nxlIssuerAddress,
        nxlAmmAccount: settings.xrpl.nxlAmmAccount,
        explorerBase: settings.xrpl.explorerBase,
        explorerTxBase: settings.xrpl.explorerTxBase,
        explorerAccountBase: settings.xrpl.explorerAccountBase,
      },
      updatedAt: settings.updated_at,
    };
  }
}
