import { Router, Request, Response } from 'express';

const router = Router();

router.use((_req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    error: 'This provider is not connected. Risk scores, UPI, TRON, and perpetuals quotes are not issued by this API.',
  });
});

export default router;
