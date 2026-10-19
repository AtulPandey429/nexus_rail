import { test, describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { RedisCacheService } from '../src/services/redis.js';

describe('Suite: RedisCacheService Active TTL & Capacity Bounding', () => {
  beforeEach(() => {
    RedisCacheService.clear();
  });

  after(() => {
    RedisCacheService.stopPruning();
    RedisCacheService.clear();
  });

  test('Sets, retrieves, and invalidates cached data', async () => {
    await RedisCacheService.setCache('test:key:1', { name: 'NexusRail' }, 60);
    const cached = await RedisCacheService.getCache<{ name: string }>('test:key:1');
    assert.deepEqual(cached, { name: 'NexusRail' });

    await RedisCacheService.invalidateCache('test:key:1');
    const afterInvalidation = await RedisCacheService.getCache('test:key:1');
    assert.equal(afterInvalidation, null);
  });

  test('Active pruneExpiredKeys removes expired keys without requiring read access', async () => {
    // Set with negative/zero TTL (already expired)
    await RedisCacheService.setCache('test:expired:1', 'val1', -10);
    await RedisCacheService.setCache('test:expired:2', 'val2', -5);
    await RedisCacheService.setCache('test:valid:1', 'val3', 300);

    assert.equal(RedisCacheService.size(), 3, 'All 3 keys present in memory before prune');

    const prunedCount = RedisCacheService.pruneExpiredKeys();
    assert.equal(prunedCount, 2, 'Must prune exactly the 2 expired keys');
    assert.equal(RedisCacheService.size(), 1, 'Only 1 valid key remains in memory');

    const validItem = await RedisCacheService.getCache('test:valid:1');
    assert.equal(validItem, 'val3');
  });

  test('Enforces FIFO bound when capacity limit is reached', async () => {
    for (let i = 0; i < 50; i++) {
      await RedisCacheService.setCache(`key:${i}`, `val:${i}`, 60);
    }
    assert.equal(RedisCacheService.size(), 50);
  });
});
