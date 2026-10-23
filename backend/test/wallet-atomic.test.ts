import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import dotenv from 'dotenv';

// Load workspace root .env if present
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { walletService } from '../src/services/wallet.js';
import { MongoService } from '../src/services/mongo.js';

describe('Suite: Atomic Wallet Balance & Overdraft Defense', () => {
  const testUserId = `user_atomic_${Date.now()}`;

  after(async () => {
    await MongoService.close();
  });

  test('Rejects non-positive or invalid debit amounts', async () => {
    await assert.rejects(
      async () => walletService.debitBalance(testUserId, -500),
      /Amount must be a positive number/
    );

    await assert.rejects(
      async () => walletService.debitBalance(testUserId, 0),
      /Amount must be a positive number/
    );

    await assert.rejects(
      async () => walletService.debitBalance(testUserId, NaN),
      /Amount must be a positive number/
    );
  });

  test('Rejects debit when account has insufficient balance ($0)', async () => {
    await assert.rejects(
      async () => walletService.debitBalance(testUserId, 2500, 'USD', 'test_order'),
      /Insufficient USD balance/
    );
  });

  test('Concurrent debit defense: Parallel debits exceeding available funds are safely rejected', async () => {
    const concurrentUserId = `user_concurrent_${Date.now()}`;
    // Credit $10.00 (1000 cents)
    await walletService.creditBalance(concurrentUserId, 1000, 'USD', 'test_deposit');

    // Attempt two simultaneous debits of $8.00 (800 cents). Combined = $16, which exceeds $10.
    const [res1, res2] = await Promise.allSettled([
      walletService.debitBalance(concurrentUserId, 800, 'USD', 'concurrent_1'),
      walletService.debitBalance(concurrentUserId, 800, 'USD', 'concurrent_2'),
    ]);

    // Exactly one debit must succeed and one must be rejected
    const succeeded = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejected = [res1, res2].filter((r) => r.status === 'rejected');

    assert.equal(succeeded.length, 1, 'Exactly one concurrent debit must succeed');
    assert.equal(rejected.length, 1, 'Exactly one concurrent debit must be rejected');

    // Final balance must be $2.00 (200 cents), never negative!
    const finalBalance = await walletService.getBalance(concurrentUserId);
    assert.equal(finalBalance.USD, 200, 'Final balance must be exactly $2.00 without overdraft');
  });
});
