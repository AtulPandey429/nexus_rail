import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DualRailTokenService } from '../src/services/dualRailTokenService.js';
import { NrTokenService } from '../src/services/nrTokenService.js';

describe('Suite: XRPL Trustline Verification & NXL Dual-Rail Swaps', () => {
  const USER_ACCOUNT_WITH_LINE = 'r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt';
  const RANDOM_ACCOUNT_WITHOUT_LINE = 'rPT1Sjq2YGrBMTttX4GZHjKu9DYfzbpAYe';
  const VAULT_ACCOUNT_WITH_LINE = 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp';

  it('Verifies trustline presence for user account r9ksrsLGVhbVeMB2fQHtBoDfDkcZ5m2Gdt', async () => {
    const status = await DualRailTokenService.checkXrplTrustline(USER_ACCOUNT_WITH_LINE, 'NXL');
    assert.equal(status.hasTrustline, true, 'User account now has verified active trustline');
    assert.equal(status.account, USER_ACCOUNT_WITH_LINE);
    assert.ok(status.issuer.startsWith('r'), 'Issuer must be a valid classic address');
    assert.equal(status.currency, 'NXL');
    assert.ok(status.balance >= 0, 'Balance must be non-negative');
  });

  it('Verifies trustline absence for unconfigured account', async () => {
    const status = await DualRailTokenService.checkXrplTrustline(RANDOM_ACCOUNT_WITHOUT_LINE, 'NXL');
    assert.equal(status.hasTrustline, false, 'Unconfigured account should not have trustline');
  });

  it('Verifies trustline presence for platform vault distributor', async () => {
    const status = await DualRailTokenService.checkXrplTrustline(VAULT_ACCOUNT_WITH_LINE, 'NXL');
    assert.equal(status.hasTrustline, true, 'Vault should have active trustline');
    assert.ok(Number(status.limit) > 0, 'Trustline limit must be positive');
  });

  it('Strictly rejects on-chain NXL withdrawal to accounts without trustline', async () => {
    await assert.rejects(
      async () => {
        await DualRailTokenService.withdrawNrToXrplAddress(
          'test_user',
          5,
          RANDOM_ACCOUNT_WITHOUT_LINE
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('Trustline Missing') || err.message.includes('Trustline'));
        return true;
      }
    );
  });

  it('Calculates accurate non-zero AMM swap quote for 5 XRP -> NXL', async () => {
    const quote = await NrTokenService.quoteSwap({
      fromAsset: 'XRP',
      toAsset: 'NXL',
      amount: 5,
    });

    assert.equal(quote.fromAsset, 'XRP');
    assert.equal(quote.toAsset, 'NXL');
    assert.equal(quote.payAmount, 5);
    assert.ok(quote.receiveAmount > 0, 'Receive amount must be positive');
    assert.ok(quote.exchangeRate > 0, 'Exchange rate must be positive');
    assert.ok(quote.spotPriceAfterUsd > 0, 'Spot price must be positive');
  });
});
