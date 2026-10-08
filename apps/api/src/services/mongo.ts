import { MongoClient } from 'mongodb';

export interface AgentAuditTrace {
  id?: string;
  userId: string;
  sessionId: string;
  prompt: string;
  response: string;
  toolsInvoked?: string[];
  latencyMs: number;
  createdAt: string;
}

export class MongoAuditLogger {
  private static client: MongoClient | null = null;

  private static getClient(): MongoClient | null {
    if (!this.client && process.env.MONGODB_URI) {
      this.client = new MongoClient(process.env.MONGODB_URI);
    }
    return this.client;
  }

  static async logAgentTrace(trace: Omit<AgentAuditTrace, 'id' | 'createdAt'>): Promise<void> {
    const entry: AgentAuditTrace = {
      ...trace,
      createdAt: new Date().toISOString(),
    };

    try {
      const client = this.getClient();
      if (client) {
        await client.connect();
        const db = client.db('nexusrail');
        const res = await db.collection('agent_audit_traces').insertOne(entry);
        console.log(`🍃 [MongoDB Atlas] Telemetry Audit Trace Logged (ID: ${res.insertedId}) - Database: nexusrail`);
      }
    } catch (error: any) {
      console.warn(`⚠️ [MongoDB Audit Warning]: ${error.message}`);
    }
  }
}
