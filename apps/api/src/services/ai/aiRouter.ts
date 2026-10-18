import { env, requiredEnv } from '../../config/env.js';

export interface AgentChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class AIRouterService {
  static async chatCompletion(messages: AgentChatMessage[]) {
    const startTime = Date.now();
    const apiKey = requiredEnv('GROQ_API_KEY');
    const candidateModels = Array.from(new Set([
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
      env.GROQ_MODEL,
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ]));

    let lastError: Error | null = null;

    for (const model of candidateModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            max_tokens: 400,
          }),
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const detail = payload?.error?.message || `Groq returned ${res.status}`;
          lastError = new Error(detail);
          continue; // Try next candidate model
        }

        const reply = payload?.choices?.[0]?.message?.content;
        if (reply && typeof reply === 'string') {
          return {
            reply,
            modelUsed: model,
            latencyMs: Date.now() - startTime,
          };
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('All Groq AI models were unavailable');
  }
}
