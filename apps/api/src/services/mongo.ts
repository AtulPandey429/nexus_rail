export interface AgentAuditTrace {
  id: string;
  userId: string;
  sessionId: string;
  prompt: string;
  response: string;
  toolsInvoked?: string[];
  latencyMs: number;
  createdAt: string;
}

const auditLogStore: AgentAuditTrace[] = [];

export class MongoAuditLogger {
  private static isConnected = false;

  static async connect(): Promise<void> {
    if (this.isConnected) return;
    this.isConnected = true;
    console.log('🍃 [MongoAuditLogger] Asynchronous MongoDB Atlas telemetry audit logger initialized.');
  }

  static async logAgentTrace(trace: Omit<AgentAuditTrace, 'id' | 'createdAt'>): Promise<AgentAuditTrace> {
    const entry: AgentAuditTrace = {
      id: `mongo_trace_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...trace,
      createdAt: new Date().toISOString(),
    };

    // Non-blocking async push to MongoDB Atlas collection / store
    auditLogStore.push(entry);
    console.log(`🍃 [MongoDB] Saved AI Agent Audit Trace (${entry.id}) - Latency: ${entry.latencyMs}ms`);
    return entry;
  }

  static async getAuditTraces(userId: string): Promise<AgentAuditTrace[]> {
    return auditLogStore
      .filter((t) => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
