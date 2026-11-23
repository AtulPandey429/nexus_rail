import { TESTNET_CONFIG } from '../utils/constants';

/**
 * Platform Escrow & Liquidity Bridge Vault Configuration
 *
 * Defaults to verified constants from `src/utils/constants.ts` (or networks.ts).
 * Dynamic components should prefer `usePlatformConfig()` from `src/lib/platformConfig.ts`
 * which sources live data directly from `GET /api/v1/platform/config`.
 */

export const PLATFORM_STELLAR_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_STELLAR_VAULT ||
  process.env.NEXT_PUBLIC_STELLAR_NR_DISTRIBUTOR_VAULT ||
  TESTNET_CONFIG.stellar.merchantVault;

export const PLATFORM_XRPL_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_XRPL_VAULT ||
  process.env.NEXT_PUBLIC_XRPL_NR_DISTRIBUTOR_VAULT ||
  TESTNET_CONFIG.xrpl.merchantVault;

