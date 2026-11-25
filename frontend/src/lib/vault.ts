/**
 * Platform escrow & liquidity bridge vault addresses.
 *
 * These are build-time overrides only. Runtime UI should prefer
 * `usePlatformConfig()` from `src/lib/platformConfig.ts`, which reads
 * `GET /api/v1/platform/config`.
 *
 * There is no literal address fallback: when a vault is not configured the
 * caller must render an "unavailable" state instead of inventing an address.
 */

export const PLATFORM_STELLAR_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_STELLAR_VAULT ||
  process.env.NEXT_PUBLIC_STELLAR_NR_DISTRIBUTOR_VAULT ||
  '';

export const PLATFORM_XRPL_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_XRPL_VAULT ||
  process.env.NEXT_PUBLIC_XRPL_NR_DISTRIBUTOR_VAULT ||
  '';
