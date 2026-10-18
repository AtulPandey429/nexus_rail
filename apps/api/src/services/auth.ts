import crypto from 'crypto';
import { verifyMessage } from 'ethers';
import { MongoService, MongoUserDoc, MongoNonceDoc } from './mongo.js';
import { signToken, TokenUser } from './jwt.js';

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const actual = Buffer.from(crypto.scryptSync(password, salt, 32).toString('hex'));
  const expected = Buffer.from(hash);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function publicUser(doc: MongoUserDoc): TokenUser {
  return {
    id: doc.id,
    email: doc.email,
    walletAddress: doc.walletAddress,
    role: doc.role,
  };
}

export class AuthService {
  /**
   * Register a new user with email & password into MongoDB
   */
  static async register(email: string, password: string): Promise<{ user: TokenUser; token: string }> {
    const cleanEmail = email.toLowerCase().trim();
    const usersCol = await MongoService.getCollection<MongoUserDoc>('users');

    const existing = await usersCol.findOne({ email: cleanEmail });
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const newUser: MongoUserDoc = {
      id,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      role: 'user',
      createdAt: now,
      updatedAt: now,
    };

    await usersCol.insertOne(newUser);
    const user = publicUser(newUser);
    const token = signToken(user);

    return { user, token };
  }

  static async ensureDefaultUsers(): Promise<void> {
    try {
      const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
      const adminDoc = await usersCol.findOne({ email: 'admin@nexusrail.dev' });
      if (!adminDoc) {
        const now = new Date().toISOString();
        await usersCol.insertOne({
          id: 'user_admin_nexus_01',
          email: 'admin@nexusrail.dev',
          passwordHash: hashPassword('Admin1234!'),
          role: 'admin',
          createdAt: now,
          updatedAt: now,
        });
      }
      const demoDoc = await usersCol.findOne({ email: 'demo@nexusrail.dev' });
      if (!demoDoc) {
        const now = new Date().toISOString();
        await usersCol.insertOne({
          id: 'user_demo_shopper_01',
          email: 'demo@nexusrail.dev',
          passwordHash: hashPassword('Demo1234!'),
          role: 'user',
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (err: any) {
      console.warn('⚠️ [MongoDB Auth Seed Warning]:', err.message);
    }
  }

  /**
   * Authenticate an existing user via email & password from MongoDB
   */
  static async login(email: string, password: string): Promise<{ user: TokenUser; token: string }> {
    await this.ensureDefaultUsers();
    const cleanEmail = email.toLowerCase().trim();
    const usersCol = await MongoService.getCollection<MongoUserDoc>('users');

    const doc = await usersCol.findOne({ email: cleanEmail });
    if (!doc || !doc.passwordHash || !checkPassword(password, doc.passwordHash)) {
      throw new Error('Invalid email or password');
    }

    const user = publicUser(doc);
    const token = signToken(user);

    return { user, token };
  }

  /**
   * Fetch authenticated user by ID from MongoDB
   */
  static async getUserById(userId: string): Promise<TokenUser | null> {
    const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
    const doc = await usersCol.findOne({ id: userId });
    return doc ? publicUser(doc) : null;
  }

  /**
   * Create an authentication nonce challenge for Web3 wallet login
   */
  static async createNonce(walletAddress: string): Promise<string> {
    const address = walletAddress.toLowerCase().trim();
    const nonce = `Sign in to NexusRail\n${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min TTL

    const noncesCol = await MongoService.getCollection<MongoNonceDoc>('auth_nonces');
    await noncesCol.updateOne(
      { walletAddress: address },
      { $set: { nonce, expiresAt } },
      { upsert: true }
    );

    return nonce;
  }

  /**
   * Verify an EVM or Web3 signature challenge and issue JWT
   */
  static async verifyWallet(walletAddress: string, signature: string, nonce: string): Promise<{ user: TokenUser; token: string }> {
    const address = walletAddress.toLowerCase().trim();
    const noncesCol = await MongoService.getCollection<MongoNonceDoc>('auth_nonces');
    const challenge = await noncesCol.findOne({ walletAddress: address });

    if (!challenge || challenge.nonce !== nonce || challenge.expiresAt.getTime() < Date.now()) {
      throw new Error('Sign-in challenge is missing or expired');
    }

    let recovered = '';
    try {
      recovered = verifyMessage(nonce, signature).toLowerCase();
    } catch {
      throw new Error('Wallet signature could not be verified');
    }

    if (recovered !== address) {
      throw new Error('Wallet signature does not match this address');
    }

    // Clean up consumed nonce
    await noncesCol.deleteOne({ walletAddress: address });

    const usersCol = await MongoService.getCollection<MongoUserDoc>('users');
    const userDoc = await usersCol.findOne({ walletAddress: address });
    let resolvedUser: MongoUserDoc;

    if (!userDoc) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const newUser: MongoUserDoc = {
        id,
        walletAddress: address,
        role: 'user',
        createdAt: now,
        updatedAt: now,
      };
      await usersCol.insertOne(newUser);
      resolvedUser = newUser;
    } else {
      resolvedUser = userDoc;
    }

    const user = publicUser(resolvedUser);
    const token = signToken(user);

    return { user, token };
  }
}
