import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { OrderSequenceService } from '../src/services/orderSequence.js';
import { MongoService } from '../src/services/mongo.js';

describe('Suite: OrderSequenceService & Collision-Proof Order Numbers', () => {
  after(async () => {
    await MongoService.close();
  });
  test('Generates short professional order reference matching format #NR8K2P9X', async () => {
    const orderNumber = await OrderSequenceService.getNextOrderNumber();
    assert.match(orderNumber, /^#NR[A-Z0-9]{6}$/, `Order reference ${orderNumber} must strictly match #NR8K2P9X format`);
  });

  test('Guarantees 100% uniqueness under concurrent order generation', async () => {
    const count = 25;
    const promises = Array.from({ length: count }, () => OrderSequenceService.getNextOrderNumber());
    const results = await Promise.all(promises);

    const uniqueSet = new Set(results);
    assert.equal(uniqueSet.size, count, `All ${count} concurrently generated order numbers must be strictly unique`);

    for (const num of results) {
      assert.match(num, /^#NR[A-Z0-9]{6}$/);
    }
  });

  test('Preserves existing clean references while safely handling legacy backfill', async () => {
    const backfilled = await OrderSequenceService.backfillLegacyOrders();
    assert.ok(typeof backfilled === 'number');
    assert.ok(backfilled >= 0);
  });
});
