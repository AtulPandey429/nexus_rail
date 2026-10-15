import { env } from '../../config/env.js';

export interface AgentChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentResponse {
  reply: string;
  modelUsed: string;
  latencyMs: number;
  toolCalls?: Array<{
    name: string;
    args: Record<string, any>;
  }>;
}

export class AIRouterService {
  static async chatCompletion(messages: AgentChatMessage[]): Promise<AgentResponse> {
    const startTime = Date.now();
    const apiKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY;

    if (!apiKey) {
      return {
        reply: 'Groq API Key is missing. Please configure GROQ_API_KEY in .env file.',
        modelUsed: 'mock-fallback',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Primary call to Groq API (openai/gpt-oss-20b or llama models)
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages,
          temperature: 0.2,
          max_tokens: 300,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.choices[0]?.message?.content || 'I am ready to assist you with NexusRail commerce operations.';
        return {
          reply,
          modelUsed: 'groq/openai/gpt-oss-20b',
          latencyMs: Date.now() - startTime,
        };
      } else {
        const errText = await res.text();
        console.warn('⚠️ Groq API warning, falling back to fast responder:', errText);
      }
    } catch (error: any) {
      console.warn('⚠️ AIRouter error:', error.message);
    }

    // High-speed fallback responder
    return {
      reply: 'NexusRail AI Desk active. How can I assist you with XRP/XLM payments or catalog orders?',
      modelUsed: 'nexusrail-fast-fallback',
      latencyMs: Date.now() - startTime,
    };
  }
}
