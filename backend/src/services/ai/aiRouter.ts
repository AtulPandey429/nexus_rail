import { env, requiredEnv } from '../../config/env.js';

export interface AgentChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: GroqToolCall[];
}

export interface GroqToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface GroqToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
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

    // 2. Build prioritized candidate list (2026 production tool-calling models first)
    const candidateModels = Array.from(new Set([
      env.GROQ_MODEL,
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      ...liveModels,
    ].filter(Boolean) as string[]));

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

  /**
   * Native Groq Production Tool Calling (`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`)
   */
  static async chatWithTools(params: {
    messages: AgentChatMessage[];
    tools: GroqToolDefinition[];
    toolChoice?: 'auto' | 'none';
  }): Promise<{
    content: string | null;
    toolCalls: GroqToolCall[];
    modelUsed: string;
    latencyMs: number;
  }> {
    const startTime = Date.now();
    const apiKey = requiredEnv('GROQ_API_KEY');
    const candidateModels = Array.from(
      new Set([env.GROQ_MODEL, 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'].filter(Boolean) as string[])
    );

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
            messages: params.messages,
            tools: params.tools,
            tool_choice: params.toolChoice || 'auto',
            temperature: 0.2,
            max_tokens: 500,
          }),
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          lastError = new Error(payload?.error?.message || `Groq returned ${res.status}`);
          continue;
        }

        const msg = payload?.choices?.[0]?.message;
        if (msg) {
          return {
            content: typeof msg.content === 'string' ? msg.content : null,
            toolCalls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
            modelUsed: model,
            latencyMs: Date.now() - startTime,
          };
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error('Tool-calling AI models were unavailable');
  }
}
