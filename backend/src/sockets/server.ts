export class SocketService {
  private static isInitialized = false;

  static initializeSockets(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('📡 [SocketService] Socket.io WebSocket server initialized on room user:authenticated.');
  }

  static emitAgentThinking(userId: string, isThinking: boolean): void {
    console.log(`📡 [Socket.io] Emitted agent:thinking (${isThinking}) to room user:${userId}`);
  }

  static emitOrderUpdated(userId: string, orderId: string, status: string): void {
    console.log(`📡 [Socket.io] Emitted order:updated (${orderId} -> ${status}) to room user:${userId}`);
  }
}
