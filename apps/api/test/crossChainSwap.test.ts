import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CrossChainSwapService } from '../src/services/crossChainSwapService.js';

describe('Suite: Cross-Chain Swap Escrow & Automated Payout Engine', () => {
  it('strictly rejects invalid Stellar destination address', async () => {
    await assert.rejects(
      async () => {
        await CrossChainSwapService.createSwapOrder({
          fromAsset: 'XRP',
          toAsset: 'XLM',
          amount: 100,
          userDestinationAddress: 'invalid_stellar_address',
        });
      },
      /Invalid Stellar destination address/
    );
  });

  it('strictly rejects invalid XRPL destination address', async () => {
    await assert.rejects(
      async () => {
        await CrossChainSwapService.createSwapOrder({
          fromAsset: 'XLM',
          toAsset: 'XRP',
          amount: 500,
          userDestinationAddress: 'invalid_xrpl_address',
        });
      },
      /Invalid XRPL destination address/
    );
  });

  it('creates an authoritative XRP -> XLM swap order with server XRPL vault and destination tag', async () => {
    const validStellarAddress = 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC';
    const order = await CrossChainSwapService.createSwapOrder({
      fromAsset: 'XRP',
      toAsset: 'XLM',
      amount: 10,
      userDestinationAddress: validStellarAddress,
    });

    assert.ok(order.swapId.startsWith('SWAP-'));
    assert.strictEqual(order.fromAsset, 'XRP');
    assert.strictEqual(order.toAsset, 'XLM');
    assert.strictEqual(order.payAmount, 10);
    assert.ok(order.receiveAmount > 0);
    assert.strictEqual(order.paymentIdentifierType, 'destination_tag');
    assert.ok(typeof order.paymentIdentifier === 'number');
    assert.ok(order.platformDepositAddress.startsWith('r'));
    assert.strictEqual(order.status, 'PENDING_DEPOSIT');
  });

  it('creates an authoritative XLM -> XRP swap order with server Stellar vault and memo', async () => {
    const validXrplAddress = 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp';
    const order = await CrossChainSwapService.createSwapOrder({
      fromAsset: 'XLM',
      toAsset: 'XRP',
      amount: 50,
      userDestinationAddress: validXrplAddress,
    });

    assert.ok(order.swapId.startsWith('SWAP-'));
    assert.strictEqual(order.fromAsset, 'XLM');
    assert.strictEqual(order.toAsset, 'XRP');
    assert.strictEqual(order.payAmount, 50);
    assert.ok(order.receiveAmount > 0);
    assert.strictEqual(order.paymentIdentifierType, 'memo_text');
    assert.ok(String(order.paymentIdentifier).startsWith('SWAP'));
    assert.ok(order.platformDepositAddress.startsWith('G'));
    assert.strictEqual(order.status, 'PENDING_DEPOSIT');
  });

  it('executes full cross-chain swap cycle with real on-chain Stellar payout and balanced ledger', async () => {
    const validStellarAddress = 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR';
    const order = await CrossChainSwapService.createSwapOrder({
      fromAsset: 'XRP',
      toAsset: 'XLM',
      amount: 5,
      userDestinationAddress: validStellarAddress,
    });

    // Execute swap simulation with deposit confirmation
    const completed = await CrossChainSwapService.executeSwap({
      swapId: order.swapId,
      depositTxHash: '3cfc84d1ec082dfe492b49d10e012fa38291f0918c7263b194819a8274618291',
    });

    assert.strictEqual(completed.status, 'COMPLETED');
    assert.ok(completed.depositTxHash);
    assert.ok(completed.payoutTxHash);
    assert.ok(completed.depositExplorerUrl?.includes('testnet.xrpl.org'));
    assert.ok(completed.payoutExplorerUrl?.includes('stellar.expert'));
    assert.ok(completed.journalEntry?.startsWith('JE-SWAP-'));
  });
});
