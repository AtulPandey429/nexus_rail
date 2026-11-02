import { Request, Response, NextFunction } from 'express';

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey || !apiKey.startsWith('nr_live_')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: missing or invalid B2B Developer API key (nr_live_...)' });
  }

  next();
}
