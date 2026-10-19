import { EventEmitter } from 'events';

export interface SettlementEvent {
  orderId: string;
  orderNumber?: string;
  status: 'PAID';
  paymentRail: string;
  txHash: string;
  timestamp: string;
}

class SettlementEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Allow high concurrent checkout connections
    this.setMaxListeners(2000);
  }

  emitSettlement(event: SettlementEvent): void {
    this.emit(`settled:${event.orderId}`, event);
    if (event.orderNumber) {
      this.emit(`settled:${event.orderNumber}`, event);
    }
  }

  onSettlement(orderId: string, listener: (event: SettlementEvent) => void): () => void {
    const eventName = `settled:${orderId}`;
    this.on(eventName, listener);
    return () => {
      this.off(eventName, listener);
    };
  }
}

export const settlementEmitter = new SettlementEventEmitter();
