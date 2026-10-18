/**
 * Development check. Prints provider errors. Does not invent a user, price, or payment.
 * Run from the repo root after apps/api dependencies are installed:
 *   npx tsx scripts/verify-master-flow.ts
 */
import { ProductService } from '../apps/api/src/services/products.js';
import { RwaGoldService } from '../apps/api/src/services/rwaGold.js';

async function step(name: string, fn: () => Promise<string>) {
  try {
    console.log(`ok  ${name}: ${await fn()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`err ${name}: ${message}`);
    return false;
  }
  return true;
}

const results = await Promise.all([
  step('products', async () => {
    const products = await ProductService.getActiveProducts();
    return `${products.length} rows`;
  }),
  step('metal quote', async () => {
    const prices = await RwaGoldService.fetchLiveCommodityPrices();
    return `gold $${prices.goldUsd}/g source ${prices.source}${prices.fromCache ? ' cache' : ''}`;
  }),
]);

if (results.some((ok) => !ok)) {
  console.error('Stopped. Missing keys and failed provider calls are errors.');
  process.exit(1);
}
