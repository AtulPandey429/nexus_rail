import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  APP_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(16).default(process.env.JWT_SECRET || 'nexusrail_development_jwt_secret_ephemeral_key_32chars'),
  MONGODB_URI: z.string().default(process.env.MONGODB_URI || ''),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  HORIZON_URL: z.string().default('https://horizon-testnet.stellar.org'),
  STELLAR_HORIZON_TESTNET_URL: z.string().default('https://horizon-testnet.stellar.org'),
  STELLAR_MERCHANT_PUBLIC_KEY: z.string().optional(),
  PLATFORM_STELLAR_VAULT: z.string().default(process.env.PLATFORM_STELLAR_VAULT || process.env.STELLAR_MERCHANT_PUBLIC_KEY || 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC'),
  STELLAR_HOT_WALLET_SECRET: z.string().optional(),
  XRPL_WSS: z.string().default('wss://s.altnet.rippletest.net:51233'),
  XRPL_TESTNET_WSS: z.string().default('wss://s.altnet.rippletest.net:51233'),
  XRPL_MERCHANT_ADDRESS: z.string().optional(),
  PLATFORM_XRPL_VAULT: z.string().default(process.env.PLATFORM_XRPL_VAULT || process.env.XRPL_MERCHANT_ADDRESS || 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp'),
  XRPL_HOT_WALLET_SEED: z.string().optional(),
  PINATA_JWT: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),

  // Official $NXL Dual-Rail Token Architecture & Issuer Keys
  STELLAR_NR_ASSET_CODE: z.string().default('NXL'),
  STELLAR_NR_ISSUER_PUBLIC: z.string().default(process.env.STELLAR_NR_ISSUER_PUBLIC || 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ'),
  STELLAR_NR_ISSUER_SECRET: z.string().optional().default(process.env.STELLAR_NR_ISSUER_SECRET || 'SAYWBF264FHGQT6HKV4ARD6VS5CYHI7B5LK4SPGPSZ7F2FML36EE2LFY'),
  STELLAR_NR_CONTRACT_ID: z.string().default(process.env.STELLAR_NR_CONTRACT_ID || 'CDGPJNW7T53P3L5X7LLVMIAPMVIYT7GNC3EVV3ZOGFVCMWQSW2HF7LPC'),
  STELLAR_NR_DISTRIBUTOR_VAULT: z.string().default(process.env.STELLAR_NR_DISTRIBUTOR_VAULT || 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC'),
  STELLAR_RPC_URL: z.string().default(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org'),
  STELLAR_NEXUS_VAULT_CONTRACT_ID: z.string().default(process.env.STELLAR_NEXUS_VAULT_CONTRACT_ID || 'CBTDO4EKCQNUZRYSNK6LXB7AOQUNCY7FOV6AYDICSAH7CY6N57CQRJVB'),
  STELLAR_NEXUS_SWAP_CONTRACT_ID: z.string().default(process.env.STELLAR_NEXUS_SWAP_CONTRACT_ID || 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM'),
  STELLAR_XLM_SAC_CONTRACT_ID: z.string().default(process.env.STELLAR_XLM_SAC_CONTRACT_ID || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'),
  STELLAR_NEXUS_VAULT_WASM_HASH: z.string().default(process.env.STELLAR_NEXUS_VAULT_WASM_HASH || 'e1d29ba2ba3e909891d702fc9ce3e01fd2adc27aac6dd97ac5335df47c817912'),
  STELLAR_NEXUS_SWAP_WASM_HASH: z.string().default(process.env.STELLAR_NEXUS_SWAP_WASM_HASH || '59fdf6924205cc3c923362d9f91d7384ff20bf5e1193d09423471c903e75c6f2'),

  XRPL_NR_CURRENCY_CODE: z.string().default('NXL'),
  XRPL_NR_CURRENCY_HEX: z.string().default('4E584C0000000000000000000000000000000000'),
  XRPL_NR_ISSUER_ADDRESS: z.string().default(process.env.XRPL_NR_ISSUER_ADDRESS || 'rfogmLyR5R2VcYsENSjqSW7iTpg9v8AbGU'),
  XRPL_NR_ISSUER_SEED: z.string().optional().default(process.env.XRPL_NR_ISSUER_SEED || 'sEd7Jo7GhaGFNP86WbUp7ornmCwapm6'),
  XRPL_NR_AMM_ACCOUNT: z.string().default(process.env.XRPL_NR_AMM_ACCOUNT || 'rDPpHaLKbyDwcuR5HupxE2KyEj3G6i9RaE'),
  XRPL_NR_DISTRIBUTOR_VAULT: z.string().default(process.env.XRPL_NR_DISTRIBUTOR_VAULT || 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp'),
});

export const env = envSchema.parse(process.env);

export function requiredEnv(name: keyof typeof env): string {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is not set`);
  }
  return value;
}
