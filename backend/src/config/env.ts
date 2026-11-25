import { z } from 'zod';
import dotenv from 'dotenv';
import { STELLAR_TESTNET, XRPL_TESTNET } from '../utils/constants.js';

dotenv.config();

/**
 * Environment configuration schema.
 *
 * NOTE: Only truly sensitive variables (secrets, private keys, database connection
 * strings, JWT secret, API keys) or runtime server settings (PORT, NODE_ENV, CORS)
 * must be populated in .env.
 *
 * Public testnet addresses, contract IDs, and network endpoints default to values
 * defined in `src/utils/constants.ts` (or `networks.ts`) so they do not pollute .env.
 */
const envSchema = z.object({
  // Server & Environment (Non-secret runtime settings)
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  APP_URL: z.string().default('http://localhost:3000'),
  API_SERVER_URL: z.string().default('http://localhost:4000'),

  // Sensitive Secrets (Belong in .env)
  JWT_SECRET: z.string().min(16).default(process.env.JWT_SECRET || 'nexusrail_development_jwt_secret_ephemeral_key_32chars'),
  MONGODB_URI: z.string().default(process.env.MONGODB_URI || ''),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PINATA_JWT: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),

  // Hot wallet & issuer secrets (Sensitive, optional / fallback for testnet dev)
  STELLAR_HOT_WALLET_SECRET: z.string().optional(),
  STELLAR_BUYBACK_RESERVE_SECRET: z.string().optional(),
  STELLAR_BUYBACK_RESERVE_PUBLIC: z.string().optional(),
  XRPL_HOT_WALLET_SEED: z.string().optional(),
  STELLAR_NXL_ISSUER_SECRET: z.string().optional().default(process.env.STELLAR_NXL_ISSUER_SECRET || process.env.STELLAR_NR_ISSUER_SECRET || 'SAYWBF264FHGQT6HKV4ARD6VS5CYHI7B5LK4SPGPSZ7F2FML36EE2LFY'),
  STELLAR_NR_ISSUER_SECRET: z.string().optional().default(process.env.STELLAR_NXL_ISSUER_SECRET || process.env.STELLAR_NR_ISSUER_SECRET || 'SAYWBF264FHGQT6HKV4ARD6VS5CYHI7B5LK4SPGPSZ7F2FML36EE2LFY'),
  XRPL_NXL_ISSUER_SEED: z.string().optional().default(process.env.XRPL_NXL_ISSUER_SEED || process.env.XRPL_NR_ISSUER_SEED || 'sEd7Jo7GhaGFNP86WbUp7ornmCwapm6'),
  XRPL_NR_ISSUER_SEED: z.string().optional().default(process.env.XRPL_NXL_ISSUER_SEED || process.env.XRPL_NR_ISSUER_SEED || 'sEd7Jo7GhaGFNP86WbUp7ornmCwapm6'),

  // Public Network Parameters (Fallbacks from src/utils/constants.ts - DO NOT require in .env)
  HORIZON_URL: z.string().default(process.env.HORIZON_URL || STELLAR_TESTNET.horizonUrl),
  STELLAR_HORIZON_TESTNET_URL: z.string().default(process.env.STELLAR_HORIZON_TESTNET_URL || STELLAR_TESTNET.horizonUrl),
  STELLAR_RPC_URL: z.string().default(process.env.STELLAR_RPC_URL || STELLAR_TESTNET.rpcUrl),
  STELLAR_MERCHANT_PUBLIC_KEY: z.string().default(process.env.STELLAR_MERCHANT_PUBLIC_KEY || STELLAR_TESTNET.merchantVault),
  PLATFORM_STELLAR_VAULT: z.string().default(process.env.PLATFORM_STELLAR_VAULT || process.env.STELLAR_MERCHANT_PUBLIC_KEY || STELLAR_TESTNET.merchantVault),

  XRPL_WSS: z.string().default(process.env.XRPL_WSS || XRPL_TESTNET.wss),
  XRPL_TESTNET_WSS: z.string().default(process.env.XRPL_TESTNET_WSS || XRPL_TESTNET.wss),
  XRPL_MERCHANT_ADDRESS: z.string().default(process.env.XRPL_MERCHANT_ADDRESS || XRPL_TESTNET.merchantVault),
  PLATFORM_XRPL_VAULT: z.string().default(process.env.PLATFORM_XRPL_VAULT || process.env.XRPL_MERCHANT_ADDRESS || XRPL_TESTNET.merchantVault),

  // Official $NXL Dual-Rail Token Public Parameters
  STELLAR_NXL_ASSET_CODE: z.string().default(process.env.STELLAR_NXL_ASSET_CODE || process.env.STELLAR_NR_ASSET_CODE || STELLAR_TESTNET.nxlAssetCode),
  STELLAR_NR_ASSET_CODE: z.string().default(process.env.STELLAR_NXL_ASSET_CODE || process.env.STELLAR_NR_ASSET_CODE || STELLAR_TESTNET.nxlAssetCode),
  STELLAR_NXL_ISSUER_PUBLIC: z.string().default(process.env.STELLAR_NXL_ISSUER_PUBLIC || process.env.STELLAR_NR_ISSUER_PUBLIC || STELLAR_TESTNET.nxlIssuerPublic),
  STELLAR_NR_ISSUER_PUBLIC: z.string().default(process.env.STELLAR_NXL_ISSUER_PUBLIC || process.env.STELLAR_NR_ISSUER_PUBLIC || STELLAR_TESTNET.nxlIssuerPublic),
  STELLAR_NXL_CONTRACT_ID: z.string().default(process.env.STELLAR_NXL_CONTRACT_ID || process.env.STELLAR_NR_CONTRACT_ID || STELLAR_TESTNET.nxlContractId),
  STELLAR_NR_CONTRACT_ID: z.string().default(process.env.STELLAR_NXL_CONTRACT_ID || process.env.STELLAR_NR_CONTRACT_ID || STELLAR_TESTNET.nxlContractId),
  STELLAR_NR_DISTRIBUTOR_VAULT: z.string().default(process.env.STELLAR_NR_DISTRIBUTOR_VAULT || STELLAR_TESTNET.distributorVault),
  STELLAR_NEXUS_VAULT_CONTRACT_ID: z.string().default(process.env.STELLAR_NEXUS_VAULT_CONTRACT_ID || STELLAR_TESTNET.nexusVaultContractId),
  STELLAR_NEXUS_SWAP_CONTRACT_ID: z.string().default(process.env.STELLAR_NEXUS_SWAP_CONTRACT_ID || STELLAR_TESTNET.nexusSwapContractId),
  STELLAR_XLM_SAC_CONTRACT_ID: z.string().default(process.env.STELLAR_XLM_SAC_CONTRACT_ID || STELLAR_TESTNET.xlmSacContractId),
  STELLAR_NEXUS_VAULT_WASM_HASH: z.string().default(process.env.STELLAR_NEXUS_VAULT_WASM_HASH || STELLAR_TESTNET.nexusVaultWasmHash),
  STELLAR_NEXUS_SWAP_WASM_HASH: z.string().default(process.env.STELLAR_NEXUS_SWAP_WASM_HASH || STELLAR_TESTNET.nexusSwapWasmHash),

  XRPL_NXL_CURRENCY_CODE: z.string().default(process.env.XRPL_NXL_CURRENCY_CODE || process.env.XRPL_NR_CURRENCY_CODE || XRPL_TESTNET.nxlCurrencyCode),
  XRPL_NR_CURRENCY_CODE: z.string().default(process.env.XRPL_NXL_CURRENCY_CODE || process.env.XRPL_NR_CURRENCY_CODE || XRPL_TESTNET.nxlCurrencyCode),
  XRPL_NXL_CURRENCY_HEX: z.string().default(process.env.XRPL_NXL_CURRENCY_HEX || process.env.XRPL_NR_CURRENCY_HEX || XRPL_TESTNET.nxlCurrencyHex),
  XRPL_NR_CURRENCY_HEX: z.string().default(process.env.XRPL_NXL_CURRENCY_HEX || process.env.XRPL_NR_CURRENCY_HEX || XRPL_TESTNET.nxlCurrencyHex),
  XRPL_NXL_ISSUER_ADDRESS: z.string().default(process.env.XRPL_NXL_ISSUER_ADDRESS || process.env.XRPL_NR_ISSUER_ADDRESS || XRPL_TESTNET.nxlIssuerAddress),
  XRPL_NR_ISSUER_ADDRESS: z.string().default(process.env.XRPL_NXL_ISSUER_ADDRESS || process.env.XRPL_NR_ISSUER_ADDRESS || XRPL_TESTNET.nxlIssuerAddress),
  XRPL_NR_AMM_ACCOUNT: z.string().default(process.env.XRPL_NR_AMM_ACCOUNT || XRPL_TESTNET.nxlAmmAccount),
  XRPL_NR_DISTRIBUTOR_VAULT: z.string().default(process.env.XRPL_NR_DISTRIBUTOR_VAULT || XRPL_TESTNET.distributorVault),
});

export const env = envSchema.parse(process.env);

export function requiredEnv(name: keyof typeof env): string {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is not set`);
  }
  return value;
}
