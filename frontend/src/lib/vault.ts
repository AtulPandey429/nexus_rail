/**
 * Platform Escrow & Liquidity Bridge Vault Configuration
 *
 * These values are rendered in client components, so only NEXT_PUBLIC_* variables
 * may be read here. Reading server-only variables would make the server and the
 * browser resolve different addresses and trigger a React hydration mismatch.
 *
 * When no public value is configured the constants stay empty and the UI renders
 * an explicit "not configured" state instead of inventing an address.
 */

export const PLATFORM_STELLAR_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_STELLAR_VAULT ||
  process.env.NEXT_PUBLIC_STELLAR_NR_DISTRIBUTOR_VAULT ||
  '';

export const PLATFORM_XRPL_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_XRPL_VAULT ||
  process.env.NEXT_PUBLIC_XRPL_NR_DISTRIBUTOR_VAULT ||
  '';
