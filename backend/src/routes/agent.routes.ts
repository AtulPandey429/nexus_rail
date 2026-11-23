import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AgentController } from '../controllers/agent.controller.js';

export const agentRouter = Router();

// POST /api/v1/agent/chat - Natural language autonomous AI Commerce chat
agentRouter.post('/chat', requireAuth, AgentController.chat);

// POST /api/v1/agent/confirm - Execute locked multi-rail commerce proposal
agentRouter.post('/confirm', requireAuth, AgentController.confirm);

// POST /api/v1/agent/reject - Reject locked proposal
agentRouter.post('/reject', requireAuth, AgentController.reject);
