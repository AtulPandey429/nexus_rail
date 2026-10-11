import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  APP_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().default('nexusrail_jwt_secret_production_ready_crypto_key_2026_secure_tokens_9918237198'),
  MONGODB_URI: z.string().default('mongodb+srv://atul:atul@cluster0.n4jez90.mongodb.net/nexusrail?retryWrites=true&w=majority&appName=Cluster0'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  HORIZON_URL: z.string().default('https://horizon-testnet.stellar.org'),
  STELLAR_HORIZON_TESTNET_URL: z.string().default('https://horizon-testnet.stellar.org'),
  STELLAR_MERCHANT_PUBLIC_KEY: z.string().optional(),
  XRPL_WSS: z.string().default('wss://s.altnet.rippletest.net:51233'),
  XRPL_TESTNET_WSS: z.string().default('wss://s.altnet.rippletest.net:51233'),
  XRPL_MERCHANT_ADDRESS: z.string().optional(),
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
