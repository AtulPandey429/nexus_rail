import crypto from 'crypto';
import { MongoService } from './mongo.js';
import { env } from '../config/env.js';

export interface EncryptedSecretField {
  iv: string; // 12-byte initialization vector (hex)
  tag: string; // 16-byte authentication tag (hex)
  ciphertext: string; // AES-256-GCM encrypted data (hex)
}

export interface MongoEncryptedSecretsDoc {
  _id?: any;
  id: 'global_encrypted_secrets';
  secrets: Record<string, EncryptedSecretField>;
  updated_at: string;
  updated_by?: string;
}

export type PlatformSecretKeys =
  | 'stellarHotWalletSecret'
  | 'stellarBuybackReserveSecret'
  | 'stellarNxlIssuerSecret'
  | 'xrplHotWalletSeed'
  | 'xrplNxlIssuerSeed'
  | 'stripeSecretKey'
  | 'stripeWebhookSecret'
  | 'groqApiKey'
  | 'supabaseServiceRoleKey'
  | 'pinataJwt'
  | 'coingeckoApiKey';

export class VaultEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';

  /**
   * Derives a cryptographically strong 32-byte key from JWT_SECRET or custom master key.
   */
  private static getDerivedKey(): Buffer {
    const master = process.env.ENCRYPTION_MASTER_KEY || env.JWT_SECRET || 'nexusrail_default_fallback_crypto_master_key_2026';
    return crypto.createHash('sha256').update(master).digest();
  }

  /**
   * Encrypts plaintext using AES-256-GCM with authentication tag.
   */
  static encrypt(plaintext: string): EncryptedSecretField {
    if (!plaintext || typeof plaintext !== 'string') {
      return { iv: '', tag: '', ciphertext: '' };
    }
    const iv = crypto.randomBytes(12); // 96-bit recommended IV for GCM
    const key = this.getDerivedKey();
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      iv: iv.toString('hex'),
      tag,
      ciphertext: encrypted,
    };
  }

  /**
   * Decrypts an encrypted field with tag verification.
   */
  static decrypt(field: EncryptedSecretField): string {
    if (!field || !field.ciphertext || !field.iv || !field.tag) {
      return '';
    }
    try {
      const key = this.getDerivedKey();
      const decipher = crypto.createDecipheriv(
        this.ALGORITHM,
        key,
        Buffer.from(field.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(field.tag, 'hex'));

      let decrypted = decipher.update(field.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      console.warn('⚠️ [VaultEncryption] Decryption tag mismatch or corrupt secret:', err.message);
      return '';
    }
  }

  /**
   * Default sensitive secrets map pulled from initial environment.
   */
  private static getInitialEnvSecrets(): Record<string, string> {
    return {
      stellarHotWalletSecret: env.STELLAR_HOT_WALLET_SECRET || '',
      stellarBuybackReserveSecret: env.STELLAR_BUYBACK_RESERVE_SECRET || '',
      stellarNxlIssuerSecret: env.STELLAR_NXL_ISSUER_SECRET || '',
      xrplHotWalletSeed: env.XRPL_HOT_WALLET_SEED || '',
      xrplNxlIssuerSeed: env.XRPL_NXL_ISSUER_SEED || '',
      stripeSecretKey: env.STRIPE_SECRET_KEY || '',
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
      groqApiKey: env.GROQ_API_KEY || '',
      supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
      pinataJwt: env.PINATA_JWT || '',
      coingeckoApiKey: env.COINGECKO_API_KEY || '',
    };
  }

  /**
   * Retrieves all decrypted secrets from MongoDB (Admin-only).
   * Auto-encrypts and seeds from env if not yet present in DB.
   */
  static async getDecryptedSecrets(): Promise<Record<string, string>> {
    try {
      const col = await MongoService.getCollection<MongoEncryptedSecretsDoc>('platform_secrets');
      let doc = await col.findOne({ id: 'global_encrypted_secrets' });

      if (!doc || !doc.secrets || Object.keys(doc.secrets).length === 0) {
        // Auto-seed with encrypted env secrets
        const initial = this.getInitialEnvSecrets();
        const encryptedRecord: Record<string, EncryptedSecretField> = {};

        for (const [key, val] of Object.entries(initial)) {
          if (val) {
            encryptedRecord[key] = this.encrypt(val);
          }
        }

        const newDoc: MongoEncryptedSecretsDoc = {
          id: 'global_encrypted_secrets',
          secrets: encryptedRecord,
          updated_at: new Date().toISOString(),
          updated_by: 'system_init',
        };

        await col.updateOne(
          { id: 'global_encrypted_secrets' },
          { $setOnInsert: newDoc },
          { upsert: true }
        );
        doc = await col.findOne({ id: 'global_encrypted_secrets' });
      }

      const result: Record<string, string> = {};
      const fallback = this.getInitialEnvSecrets();

      for (const key of Object.keys(fallback)) {
        if (doc?.secrets?.[key]) {
          const dec = this.decrypt(doc.secrets[key]);
          result[key] = dec || fallback[key] || '';
        } else {
          result[key] = fallback[key] || '';
        }
      }

      return result;
    } catch (err: any) {
      console.warn('⚠️ [VaultEncryption] Database lookup warning, using runtime env:', err.message);
      return this.getInitialEnvSecrets();
    }
  }

  /**
   * Updates and encrypts sensitive secrets in MongoDB Atlas (Admin-only).
   */
  static async updateSecrets(
    updates: Record<string, string>,
    adminId?: string
  ): Promise<Record<string, string>> {
    const col = await MongoService.getCollection<MongoEncryptedSecretsDoc>('platform_secrets');
    const existingDoc = await col.findOne({ id: 'global_encrypted_secrets' });
    const currentEncrypted: Record<string, EncryptedSecretField> = existingDoc?.secrets || {};

    for (const [key, plaintext] of Object.entries(updates)) {
      if (typeof plaintext === 'string' && plaintext.trim() !== '') {
        currentEncrypted[key] = this.encrypt(plaintext.trim());
      }
    }

    const now = new Date().toISOString();
    await col.updateOne(
      { id: 'global_encrypted_secrets' },
      {
        $set: {
          secrets: currentEncrypted,
          updated_at: now,
          updated_by: adminId || 'admin',
        },
      },
      { upsert: true }
    );

    await this.hydrateRuntimeEnvSecrets();

    // Return the fresh decrypted map
    return this.getDecryptedSecrets();
  }

  /**
   * Resolves a single secret key, preferring runtime env if non-empty and falling back
   * to the AES-256-GCM encrypted secret stored in MongoDB `platform_secrets`.
   */
  static async getSecretValue(key: PlatformSecretKeys): Promise<string> {
    const initial = this.getInitialEnvSecrets()[key];
    if (initial && initial.trim()) return initial.trim();
    const secrets = await this.getDecryptedSecrets();
    return (secrets[key] || '').trim();
  }

  /**
   * Hydrates decrypted secrets from MongoDB `platform_secrets` into runtime `env` and
   * `process.env` when omitted from host environment variables (e.g. Render / Vercel).
   */
  static async hydrateRuntimeEnvSecrets(): Promise<void> {
    try {
      const secrets = await this.getDecryptedSecrets();
      const mapping: Array<[PlatformSecretKeys, Array<keyof typeof env>]> = [
        ['stellarHotWalletSecret', ['STELLAR_HOT_WALLET_SECRET']],
        ['stellarBuybackReserveSecret', ['STELLAR_BUYBACK_RESERVE_SECRET']],
        ['stellarNxlIssuerSecret', ['STELLAR_NXL_ISSUER_SECRET', 'STELLAR_NR_ISSUER_SECRET']],
        ['xrplHotWalletSeed', ['XRPL_HOT_WALLET_SEED']],
        ['xrplNxlIssuerSeed', ['XRPL_NXL_ISSUER_SEED', 'XRPL_NR_ISSUER_SEED']],
        ['stripeSecretKey', ['STRIPE_SECRET_KEY']],
        ['stripeWebhookSecret', ['STRIPE_WEBHOOK_SECRET']],
        ['groqApiKey', ['GROQ_API_KEY']],
        ['supabaseServiceRoleKey', ['SUPABASE_SERVICE_ROLE_KEY']],
        ['pinataJwt', ['PINATA_JWT']],
        ['coingeckoApiKey', ['COINGECKO_API_KEY']],
      ];

      for (const [secretKey, envKeys] of mapping) {
        const val = secrets[secretKey];
        if (!val) continue;
        for (const envKey of envKeys) {
          if (!process.env[envKey]) {
            process.env[envKey] = val;
          }
          if (!(env as any)[envKey]) {
            (env as any)[envKey] = val;
          }
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [VaultEncryption] Runtime env hydration warning:', err?.message);
    }
  }
}
