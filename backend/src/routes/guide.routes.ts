import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { GuideController } from '../controllers/guide.controller.js';

export const guideRouter = Router();
guideRouter.use(requireAuth);

// GET /api/v1/guide/messages - Chat history
guideRouter.get('/messages', GuideController.getMessages);

// POST /api/v1/guide/messages - Send question to AI Shopping Guide
guideRouter.post('/messages', GuideController.sendMessage);
