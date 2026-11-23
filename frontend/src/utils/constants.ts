/**
 * Dual-Network Configuration (Testnet & Mainnet) & Platform Constants
 *
 * This file contains comprehensive parameters, contract addresses,
 * public vault keys, token identifiers, and network RPC/WSS endpoints
 * for both Stellar and XRPL (Testnet and Mainnet).
 */

export type NetworkEnvironment = 'testnet' | 'mainnet';

export interface StellarNetworkConfig {
  network: NetworkEnvironment;
  networkPassphrase: string;
  horizonUrl: string;
  rpcUrl: string;
  merchantVault: string;
  distributorVault: string;

  // NXL Dual-Rail Token (Stellar SAC)
  nxlAssetCode: string;
  nxlIssuerPublic: string;
  nxlContractId: string;

  // Soroban Smart Contracts
  nexusVaultContractId: string;
  nexusSwapContractId: string;
  xlmSacContractId: string;
  nexusVaultWasmHash: string;
  nexusSwapWasmHash: string;

  // Explorers
  explorerBase: string;
  explorerTxBase: string;
  explorerAccountBase: string;
  explorerContractBase: string;

  // Historical Reference Txs (Optional)
  mintTx?: string;
  contractDeployTx?: string;
}

export interface XrplNetworkConfig {
  network: NetworkEnvironment;
  wss: string;
  merchantVault: string;
  distributorVault: string;

  // NXL Dual-Rail Token (XRPL Issued Currency & AMM)
  nxlCurrencyCode: string;
  nxlCurrencyHex: string;
  nxlIssuerAddress: string;
  nxlAmmAccount: string;

  // Explorers
  explorerBase: string;
  explorerTxBase: string;
  explorerAccountBase: string;

  // Historical Reference Txs (Optional)
  trustSetTx?: string;
  mintTx?: string;
  ammCreateTx?: string;
}

export interface NetworkConfig {
  environment: NetworkEnvironment;
  stellar: StellarNetworkConfig;
  xrpl: XrplNetworkConfig;
}

export const STELLAR_TESTNET: StellarNetworkConfig = {
  network: 'testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  merchantVault: 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC',
  distributorVault: 'GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC',

  nxlAssetCode: 'NXL',
  nxlIssuerPublic: 'GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ',
  nxlContractId: 'CDGPJNW7T53P3L5X7LLVMIAPMVIYT7GNC3EVV3ZOGFVCMWQSW2HF7LPC',

  nexusVaultContractId: 'CBTDO4EKCQNUZRYSNK6LXB7AOQUNCY7FOV6AYDICSAH7CY6N57CQRJVB',
  nexusSwapContractId: 'CCJBRAJ5JUQPMIMGHDZKGRNXRZVJU5KBU7PMNJK235ORSXUSSHCPQYAM',
  xlmSacContractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  nexusVaultWasmHash: 'e1d29ba2ba3e909891d702fc9ce3e01fd2adc27aac6dd97ac5335df47c817912',
  nexusSwapWasmHash: '59fdf6924205cc3c923362d9f91d7384ff20bf5e1193d09423471c903e75c6f2',

  explorerBase: 'https://stellar.expert/explorer/testnet',
  explorerTxBase: 'https://stellar.expert/explorer/testnet/tx/',
  explorerAccountBase: 'https://stellar.expert/explorer/testnet/account/',
  explorerContractBase: 'https://stellar.expert/explorer/testnet/contract/',

  mintTx: 'd1df7215d2a13eec52a163b343d95f01fdeb50011db2c4977d933a0e3af5cc22',
  contractDeployTx: '2fd805157a5ae338f69ecbb1774337102304054af2d5fbeea2f424ec76b90189',
};

export const STELLAR_MAINNET: StellarNetworkConfig = {
  network: 'mainnet',
  networkPassphrase: 'Public Global Stellar Network ; September 2015',
  horizonUrl: 'https://horizon.stellar.org',
  rpcUrl: 'https://soroban-rpc.mainnet.stellar.org',
  merchantVault: '',
  distributorVault: '',

  nxlAssetCode: 'NXL',
  nxlIssuerPublic: '',
  nxlContractId: '',

  nexusVaultContractId: '',
  nexusSwapContractId: '',
  xlmSacContractId: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
  nexusVaultWasmHash: '',
  nexusSwapWasmHash: '',

  explorerBase: 'https://stellar.expert/explorer/public',
  explorerTxBase: 'https://stellar.expert/explorer/public/tx/',
  explorerAccountBase: 'https://stellar.expert/explorer/public/account/',
  explorerContractBase: 'https://stellar.expert/explorer/public/contract/',
};

export const XRPL_TESTNET: XrplNetworkConfig = {
  network: 'testnet',
  wss: 'wss://s.altnet.rippletest.net:51233',
  merchantVault: 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp',
  distributorVault: 'rHPcjCjp2dymiMtdHdQSZae1kR3gMYDgAp',

  nxlCurrencyCode: 'NXL',
  nxlCurrencyHex: '4E584C0000000000000000000000000000000000',
  nxlIssuerAddress: 'rfogmLyR5R2VcYsENSjqSW7iTpg9v8AbGU',
  nxlAmmAccount: 'rDPpHaLKbyDwcuR5HupxE2KyEj3G6i9RaE',

  explorerBase: 'https://testnet.xrpl.org',
  explorerTxBase: 'https://testnet.xrpl.org/transactions/',
  explorerAccountBase: 'https://testnet.xrpl.org/accounts/',

  trustSetTx: 'FFF41C0D9DF1BE76D2D4F09EA4F175B6A47D7D8DB5E1BDC912C1CB3F96C2700F',
  mintTx: '1DA871DBA4B27A23873013EBDCC268BC6FB822A3C3D2C77426D482174BE858E5',
  ammCreateTx: '18BD4CB3319DE7068F2F456C598EAD8746E9E36AC05E3C01458A23654A6881BE',
};

export const XRPL_MAINNET: XrplNetworkConfig = {
  network: 'mainnet',
  wss: 'wss://xrplcluster.com',
  merchantVault: '',
  distributorVault: '',

  nxlCurrencyCode: 'NXL',
  nxlCurrencyHex: '4E584C0000000000000000000000000000000000',
  nxlIssuerAddress: '',
  nxlAmmAccount: '',

  explorerBase: 'https://livenet.xrpl.org',
  explorerTxBase: 'https://livenet.xrpl.org/transactions/',
  explorerAccountBase: 'https://livenet.xrpl.org/accounts/',
};

export const NETWORKS_CONFIG: Record<NetworkEnvironment, NetworkConfig> = {
  testnet: {
    environment: 'testnet',
    stellar: STELLAR_TESTNET,
    xrpl: XRPL_TESTNET,
  },
  mainnet: {
    environment: 'mainnet',
    stellar: STELLAR_MAINNET,
    xrpl: XRPL_MAINNET,
  },
};

export function getNetworkConfig(network: NetworkEnvironment = 'testnet'): NetworkConfig {
  return NETWORKS_CONFIG[network] || NETWORKS_CONFIG.testnet;
}

// Backwards-compatible aliases
export const TESTNET_CONFIG = NETWORKS_CONFIG.testnet;
export const MAINNET_CONFIG = NETWORKS_CONFIG.mainnet;
