import { Router, Request, Response } from 'express';
import { MongoService } from '../services/mongo.js';

export const showdownRouter = Router();

export interface MongoShowdownDoc {
  id: string;
  title: string;
  item_a_sku: string;
  item_b_sku: string;
  votes_a: number;
  votes_b: number;
}

const DEFAULT_SHOWDOWN: MongoShowdownDoc = {
  id: 'showdown_xrp_vs_xlm',
  title: 'Hardware Validator Node vs Smart Contract License',
  item_a_sku: 'PROD-XRP-KIT',
  item_b_sku: 'PROD-XLM-PASS',
  votes_a: 42,
  votes_b: 38,
};

async function ensureShowdownSeed() {
  try {
    const col = await MongoService.getCollection<MongoShowdownDoc>('showdowns');
    const count = await col.countDocuments();
    if (count === 0) {
      await col.insertOne({ ...DEFAULT_SHOWDOWN } as any);
    }
  } catch (err: any) {
    console.warn('⚠️ [MongoDB Showdown Seed Warning]:', err.message);
  }
}

showdownRouter.get('/', async (_req: Request, res: Response) => {
  try {
    await ensureShowdownSeed();
    const col = await MongoService.getCollection<MongoShowdownDoc>('showdowns');
    const data = await col.find().toArray();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

showdownRouter.post('/:id/vote', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const choice = req.body?.choice;
  if (choice !== 'A' && choice !== 'B') {
    return res.status(400).json({ success: false, error: 'choice must be A or B' });
  }

  try {
    await ensureShowdownSeed();
    const col = await MongoService.getCollection<MongoShowdownDoc>('showdowns');
    const incField = choice === 'A' ? { votes_a: 1 } : { votes_b: 1 };
    
    const updated = await col.findOneAndUpdate(
      { id },
      { $inc: incField },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Showdown not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
