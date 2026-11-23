import test from 'node:test';
import assert from 'node:assert/strict';
import { DualRailTokenService, STELLAR_NR_ISSUER } from '../src/services/dualRailToken.service.js';
import { Keypair, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

test('Suite: Stellar Trustline Verification & Bridge Guards', async (t) => {
  await t.test('Correctly identifies invalid Stellar address checksum (like user typo)', async () => {
    // Address from user screenshot with corrupted checksum
    const invalidChecksumAddr = 'GBS6IALQNERJAK23ZGNWCNF2UFOWUPZA5G2KD693D2D3UTOJK2XTN7ML';
    const status = await DualRailTokenService.checkStellarTrustline(invalidChecksumAddr, 'NXL');
    assert.equal(status.hasTrustline, false);
    assert.equal(status.isValidAddress, false);
    assert.match(status.error || '', /Invalid Stellar address format or checksum/);
  });

  await t.test('Rejects prepareStellarTrustlineXdr for invalid checksum address with clear error', async () => {
    const invalidChecksumAddr = 'GBS6IALQNERJAK23ZGNWCNF2UFOWUPZA5G2KD693D2D3UTOJK2XTN7ML';
    await assert.rejects(
      async () => {
        await DualRailTokenService.prepareStellarTrustlineXdr(invalidChecksumAddr, 'NXL');
      },
      /Invalid Stellar address format or checksum/
    );
  });

  await t.test('Checks genuine active distributor vault on Stellar Testnet for NXL trustline', async () => {
    const distributorVault = 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC';
    const status = await DualRailTokenService.checkStellarTrustline(distributorVault, 'NXL');
    assert.equal(status.isValidAddress, true);
    assert.equal(status.account, distributorVault);
    assert.equal(status.hasTrustline, true);
    assert.ok(status.balance >= 0);
  });

  await t.test('Builds valid change_trust XDR for a funded testnet account', async () => {
    const distributorVault = 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC';
    const prep = await DualRailTokenService.prepareStellarTrustlineXdr(distributorVault, 'NXL');
    assert.equal(prep.success, true);
    assert.ok(prep.xdr && prep.xdr.length > 50);
    assert.equal(prep.networkPassphrase, Networks.TESTNET);
    assert.equal(prep.assetCode, 'NXL');

    // Parse back the XDR and verify changeTrust operation
    const tx: any = TransactionBuilder.fromXDR(prep.xdr, Networks.TESTNET);
    assert.equal(tx.operations.length, 1);
    assert.equal(tx.operations[0].type, 'changeTrust');
    assert.equal(tx.operations[0].line.code, 'NXL');
  });
});
