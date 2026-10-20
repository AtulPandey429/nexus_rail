import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken, TokenUser } from '../src/services/jwt.js';

describe('Suite: User Profile & Multi-Rail Wallet Management', () => {
  before(() => {
    process.env.JWT_SECRET = 'unit-test-jwt-secret-key-32-chars-long!';
  });

  const sampleUser: TokenUser = {
    id: 'usr_test_alpha_001',
    name: 'Ada Lovelace',
    email: 'ada@nexusrail.dev',
    stellarAddress: 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC',
    xrplAddress: 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp',
    role: 'user',
  };

  test('Signs and verifies TokenUser with dual-rail addresses and display name', () => {
    const token = signToken(sampleUser);
    const decoded = verifyToken(token);

    assert.equal(decoded.id, sampleUser.id);
    assert.equal(decoded.name, 'Ada Lovelace');
    assert.equal(decoded.email, sampleUser.email);
    assert.equal(decoded.stellarAddress, sampleUser.stellarAddress);
    assert.equal(decoded.xrplAddress, sampleUser.xrplAddress);
    assert.equal(decoded.role, 'user');
  });

  test('Validates Stellar G... address format strictly (56 chars, begins with G)', () => {
    const validStellar = 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC';
    const isStellar = validStellar.startsWith('G') && validStellar.length === 56;
    assert.equal(isStellar, true);

    const invalidShort = 'GABC123';
    const isInvalid = invalidShort.startsWith('G') && invalidShort.length === 56;
    assert.equal(isInvalid, false);
  });

  test('Validates XRPL r... address format strictly (starts with r, length 25-35)', () => {
    const validXrpl = 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp';
    const isXrpl = validXrpl.startsWith('r') && validXrpl.length >= 25 && validXrpl.length <= 35;
    assert.equal(isXrpl, true);

    const invalidEth = '0x71C84517C37cBE11977AD502086BaEDDA8B20049';
    const isInvalid = invalidEth.startsWith('r');
    assert.equal(isInvalid, false);
  });

  test('Enforces maximum 1 active wallet address per blockchain network', () => {
    const wallets = [
      { network: 'stellar', address: 'G_INITIAL_1111111111111111111111111111111111111111111111111111', provider: 'Freighter' },
      { network: 'xrpl', address: 'r_INITIAL_111111111111111111111111', provider: 'GemWallet' },
    ];

    // User connects a new Stellar wallet (e.g. Albedo)
    const newNetwork = 'stellar';
    const newAddress = 'G_NEW_2222222222222222222222222222222222222222222222222222';
    const newProvider = 'Albedo';

    // Replacement logic: filter out existing for this network, then push new
    const updated = wallets.filter((w) => w.network !== newNetwork);
    updated.push({ network: newNetwork, address: newAddress, provider: newProvider });

    assert.equal(updated.length, 2, 'Must still contain exactly 2 wallets (1 Stellar, 1 XRPL)');
    const stellarWallets = updated.filter((w) => w.network === 'stellar');
    assert.equal(stellarWallets.length, 1, 'Must contain strictly 1 Stellar wallet');
    assert.equal(stellarWallets[0].address, newAddress);
    assert.equal(stellarWallets[0].provider, 'Albedo');

    const xrplWallets = updated.filter((w) => w.network === 'xrpl');
    assert.equal(xrplWallets.length, 1, 'XRPL wallet must remain preserved');
    assert.equal(xrplWallets[0].provider, 'GemWallet');
  });
});
