import { Request, Response } from 'express';
import { NrTokenService } from '../services/nrToken.service.js';

export class TokenController {
  /**
   * GET /api/v1/nr-token/status, /api/v1/nxl-token/status
   * Public Dual-Rail Token Pool Stats ($NXL)
   */
  static async getPoolStatus(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await NrTokenService.getPoolStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to load token pool status',
      });
    }
  }
}
