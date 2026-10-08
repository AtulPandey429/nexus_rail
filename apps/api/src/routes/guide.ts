import { Router, Request, Response } from 'express';

export const guideRouter = Router();

const threadMessages: Record<string, { role: 'user' | 'assistant'; body: string; suggestedSkus?: string[]; createdAt: string }[]> = {
  'demo-user-1': [
    {
      role: 'assistant',
      body: 'Hello! I am your NexusRail Catalog Guide. Ask me anything about our desk kit products!',
      createdAt: new Date(Date.now() - 100000).toISOString(),
    },
  ],
};

// GET /api/v1/guide/messages
guideRouter.get('/messages', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'demo-user-1';
  return res.json({ status: 'success', data: { messages: threadMessages[userId] || [] } });
});

// POST /api/v1/guide/messages (Read-only model suggestions, strict SKU filtering)
guideRouter.post('/messages', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'demo-user-1';
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'message string is required' } });
  }

  if (!threadMessages[userId]) {
    threadMessages[userId] = [];
  }

  // Record User Message
  threadMessages[userId].push({
    role: 'user',
    body: message,
    createdAt: new Date().toISOString(),
  });

  // Generate Catalog Guide Response (Read-Only)
  let reply = 'I recommend exploring our flagship desk kits in the catalog.';
  let suggestedSkus: string[] = [];

  const lower = message.toLowerCase();
  if (lower.includes('notebook') || lower.includes('paper') || lower.includes('note') || lower.includes('25') || lower.includes('30')) {
    reply = 'The Nexus A5 Hardcover Notebook Set is $24.00 USD. It features premium 120gsm paper and a lay-flat binding, making it ideal for daily journaling and planning.';
    suggestedSkus = ['NL-NOTE-A5'];
  } else if (lower.includes('pen') || lower.includes('write')) {
    reply = 'The Nexus Precision Gel Pen Set is $18.00 USD. It includes 3 ultra-smooth 0.5mm matte black pens.';
    suggestedSkus = ['NL-PEN-SET'];
  } else if (lower.includes('lamp') || lower.includes('light')) {
    reply = 'The Nexus Minimalist LED Desk Lamp is $42.00 USD. It offers touch-dimmable warm LED lighting with USB-C power.';
    suggestedSkus = ['NL-LAMP'];
  } else {
    reply = 'We have three featured desk kits: the A5 Notebook Set ($24), Gel Pen Set ($18), and Minimalist LED Desk Lamp ($42). Which one fits your setup?';
    suggestedSkus = ['NL-NOTE-A5', 'NL-PEN-SET', 'NL-LAMP'];
  }

  const assistantMsg = {
    role: 'assistant' as const,
    body: reply,
    suggestedSkus,
    createdAt: new Date().toISOString(),
  };

  threadMessages[userId].push(assistantMsg);

  return res.json({
    status: 'success',
    data: {
      reply,
      suggestedSkus,
      messages: threadMessages[userId],
    },
  });
});
