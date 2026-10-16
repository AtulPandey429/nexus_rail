import { chainRegistry } from './chainRegistry.js';
import { StellarTestnetProvider } from './stellarProvider.js';
import { XrplTestnetProvider } from './xrplProvider.js';

export const stellarProvider = new StellarTestnetProvider();
export const xrplProvider = new XrplTestnetProvider();

// Register official testnet providers
chainRegistry.register(stellarProvider);
chainRegistry.register(xrplProvider);

export { chainRegistry, StellarTestnetProvider, XrplTestnetProvider };
