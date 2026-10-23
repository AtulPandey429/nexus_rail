import { chainRegistry } from './chainRegistry.js';
import { StellarTestnetProvider, StellarUsdcTestnetProvider, CIRCLE_USDC_TESTNET_ISSUER, CIRCLE_USDC_TESTNET_ASSET } from './stellarProvider.js';
import { XrplTestnetProvider } from './xrplProvider.js';

export const stellarProvider = new StellarTestnetProvider();
export const stellarUsdcProvider = new StellarUsdcTestnetProvider();
export const xrplProvider = new XrplTestnetProvider();

// Register official testnet providers
chainRegistry.register(stellarProvider);
chainRegistry.register(stellarUsdcProvider);
chainRegistry.register(xrplProvider);

export {
  chainRegistry,
  StellarTestnetProvider,
  StellarUsdcTestnetProvider,
  XrplTestnetProvider,
  CIRCLE_USDC_TESTNET_ISSUER,
  CIRCLE_USDC_TESTNET_ASSET,
};
