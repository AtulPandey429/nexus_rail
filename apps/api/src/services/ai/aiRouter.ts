import { env, requiredEnv } from '../../config/env.js';

export interface AgentChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIRouterService {
  static async chatCompletion(messages: AgentChatMessage[]) {
    const startTime = Date.now();
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requiredEnv('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 400,
      }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = payload?.error?.message || `Groq returned ${res.status}`;
      throw new Error(detail);
    }
    const reply = payload?.choices?.[0]?.message?.content;
    if (!reply || typeof reply !== 'string') throw new Error('Groq returned an empty reply');
    return {
      reply,
      modelUsed: payload.model || env.GROQ_MODEL,
      latencyMs: Date.now() - startTime,
    };
  }
}
