export type ChainNetwork = 'testnet' | 'sandbox' | 'mainnet';

export interface ChainInvoice {
  orderId: string;
  chain: string;
  network: ChainNetwork;
  recipientAddress: string;
  paymentIdentifierType: 'memo_text' | 'destination_tag';
  paymentIdentifier: string | number;
  amountAsset: number;
  assetSymbol: string;
  amountDropsOrStroops?: string;
  amountUsdCents: number;
  fxRateUsd: number;
  expiresAt: string;
  explorerUrl?: string;
  qrPayload?: string;
}

export interface ChainVerificationResult {
  verified: boolean;
  txHash: string;
  sourceAddress?: string;
  destinationAddress?: string;
  amountDelivered?: number;
  assetSymbol: string;
  ledgerIndex?: number;
  timestamp?: string;
  network: ChainNetwork;
  error?: string;
}

export interface IChainProvider {
  readonly chainId: string;
  readonly assetSymbol: string;
  readonly network: ChainNetwork;
  
  getAccountBalance(address?: string): Promise<{ balance: number; currency: string }>;
  createInvoice(orderId: string, amountUsdCents: number): Promise<ChainInvoice>;
  verifyPayment(orderId: string, txHash: string, expectedAmountAsset?: number): Promise<ChainVerificationResult>;
  getExplorerUrl(txHash: string): string;
  validateAddress(address: string): boolean;
}

export interface AgentToolPlugin {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

export interface PaymentRailPlugin {
  id: string;
  name: string;
  createInvoice(orderId: string, amountCents: number): Promise<unknown>;
  verifyPayment(txHash: string): Promise<boolean>;
}
