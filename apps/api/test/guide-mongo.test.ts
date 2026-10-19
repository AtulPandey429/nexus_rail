import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { MongoService, MongoGuideMessageDoc } from '../src/services/mongo.js';

describe('Suite: Guide Messages MongoDB Atlas Persistence', () => {
  const testUserId = `user_guide_test_${Date.now()}`;

  after(async () => {
    await MongoService.close();
  });

  test('Persists and retrieves guide conversation thread in chronological order', async () => {
    const col = await MongoService.getCollection<MongoGuideMessageDoc>('guide_messages');
    const now = new Date().toISOString();

    // Insert user question
    await col.insertOne({
      id: `msg_u_${Date.now()}`,
      user_id: testUserId,
      role: 'user',
      body: 'Do you offer crypto hardware wallets?',
      suggested_skus: [],
      created_at: now,
    });

    // Insert assistant reply
    await col.insertOne({
      id: `msg_a_${Date.now()}`,
      user_id: testUserId,
      role: 'assistant',
      body: 'Yes, we offer RAIL-ONE with built-in multi-rail support.',
      suggested_skus: ['RAIL-ONE'],
      created_at: new Date(Date.now() + 100).toISOString(),
    });

    // Query thread
    const thread = await col.find({ user_id: testUserId }).sort({ created_at: 1 }).toArray();

    assert.equal(thread.length, 2);
    assert.equal(thread[0].role, 'user');
    assert.equal(thread[0].body, 'Do you offer crypto hardware wallets?');
    assert.equal(thread[1].role, 'assistant');
    assert.deepEqual(thread[1].suggested_skus, ['RAIL-ONE']);
  });
});
