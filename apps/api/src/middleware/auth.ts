import { Request, Response, NextFunction } from 'express';

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
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  // Basic token decode check for dev mock
  if (!token || token.length < 10) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid token signature' });
  }

  req.user = {
    id: 'usr_mock_123',
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    role: 'user',
  };

  next();
}
