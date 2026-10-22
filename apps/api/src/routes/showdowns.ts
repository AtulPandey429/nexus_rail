import { Router, Request, Response } from 'express';

export const showdownRouter = Router();

const mockShowdowns = [
  {
    id: 'showdown_1',
    title: 'XRPL Validator Node vs Stellar Soroban Contract',
    itemA: { id: 'PROD-XRP-KIT', title: 'XRPL Hardware Kit', votes: 142 },
    itemB: { id: 'PROD-XLM-PASS', title: 'Stellar Soroban Pass', votes: 98 },
  },
];

// GET /api/v1/showdowns - Fetch product showdown comparisons (Mento DNA)
showdownRouter.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: mockShowdowns });
});

// POST /api/v1/showdowns/:id/vote - Cast community vote
showdownRouter.post('/:id/vote', (req: Request, res: Response) => {
  const { choice } = req.body;
  const showdown = mockShowdowns[0];
  if (choice === 'A') showdown.itemA.votes++;
  if (choice === 'B') showdown.itemB.votes++;

  res.json({ success: true, data: showdown });
});
