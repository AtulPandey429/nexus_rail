import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwt.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    walletAddress?: string;
    role: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Sign in is required' });
  }
  try {
    req.user = verifyToken(authHeader.slice('Bearer '.length).trim());
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    return res.status(401).json({ success: false, error: message });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin role is required' });
  }
  next();
}
