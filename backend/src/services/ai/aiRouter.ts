import { env, requiredEnv } from '../../config/env.js';

export interface AgentChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// In-memory cache for live discovered Groq models
let cachedActiveModels: string[] | null = null;
let lastModelsFetchTime = 0;
const MODELS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Self-Healing Dynamic Model Resolver:
 * Queries Groq's GET /models endpoint to find all currently supported, non-decommissioned chat models.
 * Automatically adapts when models are deprecated or new models are launched.
 */
async function getLiveGroqModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedActiveModels && now - lastModelsFetchTime < MODELS_CACHE_TTL_MS) {
    return cachedActiveModels;
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        // Filter out audio (whisper) and guardrail/classifier models
        const chatModels = data.data
          .map((m: any) => String(m.id))
          .filter((id: string) => {
            const lower = id.toLowerCase();
            return (
              !lower.includes('whisper') &&
              !lower.includes('prompt-guard') &&
              !lower.includes('safeguard') &&
              !lower.includes('orpheus')
            );
          });

        if (chatModels.length > 0) {
          cachedActiveModels = chatModels;
          lastModelsFetchTime = now;
          console.log(`🤖 [AI Router Self-Healing]: Discovered ${chatModels.length} active live chat models from Groq:`, chatModels);
          return chatModels;
        }
      }
    }
  } catch (err: any) {
    console.warn('⚠️ [AI Router]: Could not fetch live models dynamically:', err.message);
  }

  return [];
}

export class AIRouterService {
  static async chatCompletion(messages: AgentChatMessage[]) {
    const startTime = Date.now();
    const apiKey = requiredEnv('GROQ_API_KEY');

    // 1. Discover live active models dynamically from Groq
    const liveModels = await getLiveGroqModels(apiKey);

    // 2. Build prioritized candidate list:
    // (Live active chat models first, followed by configured env.GROQ_MODEL and verified fallbacks)
    const candidateModels = Array.from(new Set([
      ...liveModels,
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

          // If model was decommissioned or not found, invalidate cache so next call re-syncs
          if (detail.includes('decommissioned') || detail.includes('does not exist')) {
            console.warn(`⚠️ [AI Router]: Model "${model}" is decommissioned. Auto-resolving to next candidate...`);
            cachedActiveModels = null;
          }

          lastError = new Error(detail);
          continue; // Seamlessly try next candidate model
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
