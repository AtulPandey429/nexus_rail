/**
 * Platform Escrow & Liquidity Bridge Vault Configuration
 * Reads from environment variables with graceful fallback to authorized testnet ledger vaults.
 */

export const PLATFORM_STELLAR_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_STELLAR_VAULT ||
  process.env.PLATFORM_STELLAR_VAULT ||
  process.env.STELLAR_MERCHANT_PUBLIC_KEY ||
  'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC';

export const PLATFORM_XRPL_VAULT: string =
  process.env.NEXT_PUBLIC_PLATFORM_XRPL_VAULT ||
  process.env.PLATFORM_XRPL_VAULT ||
  process.env.XRPL_MERCHANT_ADDRESS ||
  'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp';
