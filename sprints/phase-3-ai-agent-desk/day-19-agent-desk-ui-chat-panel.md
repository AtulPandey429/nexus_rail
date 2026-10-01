# 📅 Day 19: AI Agent Desk Chat Interface UI

## 🎯 Day Objective
Build a floating side panel and full-page AI Agent Desk UI with interactive suggestion pills, markdown streaming, and rich interactive cards.

---

## 🛠 Backend Tasks
- [ ] Add conversation history memory persistence in Redis (`chat:history:{userId}`).

## 🎨 Frontend Tasks
- [ ] Build `AgentDeskPanel.tsx` UI component with slide-over drawer animation.
- [ ] Add quick suggestion prompt pills ("Order XRP starter kit", "Check XLM balance", "Compare top 2 products").
- [ ] Integrate `react-markdown` and `syntax-highlighter` for code/JSON formatting in assistant responses.

## ✅ Definition of Done (DoD)
1. Agent chat panel opens smoothly from any page via Floating Dock launcher button.
2. Quick suggestion pills populate chat input on tap.
