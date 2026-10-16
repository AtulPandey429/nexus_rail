import type { IChainProvider } from '@nexusrail/shared';

export class ChainProviderRegistry {
  private static instance: ChainProviderRegistry;
  private providers = new Map<string, IChainProvider>();

  private constructor() {}

  static getInstance(): ChainProviderRegistry {
    if (!this.instance) {
      this.instance = new ChainProviderRegistry();
    }
    return this.instance;
  }

  register(provider: IChainProvider): void {
    const key = provider.chainId.toLowerCase();
    this.providers.set(key, provider);
    console.log(`⛓️ [ChainProviderRegistry] Registered ${provider.chainId.toUpperCase()} Provider (${provider.network.toUpperCase()})`);
  }

  getProvider(chainId: string): IChainProvider | undefined {
    return this.providers.get(chainId.toLowerCase());
  }

  getRequiredProvider(chainId: string): IChainProvider {
    const provider = this.getProvider(chainId);
    if (!provider) {
      const available = Array.from(this.providers.keys()).join(', ');
      throw new Error(`Unsupported chain: "${chainId}". Supported chains: [${available}]`);
    }
    return provider;
  }

  getAllProviders(): IChainProvider[] {
    return Array.from(this.providers.values());
  }
}

export const chainRegistry = ChainProviderRegistry.getInstance();
