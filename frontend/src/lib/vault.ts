/**
 * Platform Escrow & Liquidity Bridge Vault Configuration
 * Reads from environment variables with graceful fallback to authorized testnet ledger vaults.
 */

export const PLATFORM_STELLAR_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_STELLAR_VAULT ||
  process.env.PLATFORM_STELLAR_VAULT ||
  process.env.STELLAR_MERCHANT_PUBLIC_KEY ||
  'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';

export const PLATFORM_XRPL_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_XRPL_VAULT ||
  process.env.PLATFORM_XRPL_VAULT ||
  process.env.XRPL_MERCHANT_ADDRESS ||
  'rp4Q7LTC8pg5jSprV92jRdoZ9E2rhMNFxW';
