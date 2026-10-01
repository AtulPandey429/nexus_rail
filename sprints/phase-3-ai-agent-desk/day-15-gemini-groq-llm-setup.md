# 📅 Day 15: Gemini 2.0 Flash & Groq LLM Engine Setup

## 🎯 Day Objective
Integrate `@google/genai` and `groq-sdk` with streaming response support for high-speed sub-300ms AI agent operations.

---

## 🛠 Backend Tasks
- [ ] Install `@google/genai` and `groq-sdk` in `apps/api`.
- [ ] Implement AI client fallback router (`apps/api/src/services/ai/aiRouter.ts`): try Groq `llama-3.3-70b-versatile` first (latency ~180ms), fallback to Gemini 2.0 Flash.
- [ ] Implement system prompt context loading from `apps/api/src/services/ai/systemPrompt.ts`.

## 🎨 Frontend Tasks
- [ ] Setup Server-Sent Events (SSE) or WebSocket reader hook `useAgentStream.ts`.

## ✅ Definition of Done (DoD)
1. API router returns LLM completion token stream in < 300ms TTFT (Time To First Token).
2. Fallback switch from Groq to Gemini Flash triggers automatically if rate limit is reached.
