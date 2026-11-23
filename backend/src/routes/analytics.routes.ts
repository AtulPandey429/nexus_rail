import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requireAdmin);

// GET /api/v1/analytics/summary - Platform metrics overview
analyticsRouter.get('/summary', AnalyticsController.getSummary);
