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
});

export const env = envSchema.parse(process.env);

export function requiredEnv(name: keyof typeof env): string {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is not set`);
  }
  return value;
}
