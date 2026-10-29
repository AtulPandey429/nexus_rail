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
