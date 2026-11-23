import { Router } from 'express';
import { ShowdownController } from '../controllers/showdown.controller.js';

export const showdownRouter = Router();

// GET /api/v1/showdowns - List all product showdowns
showdownRouter.get('/', ShowdownController.getShowdowns);

// POST /api/v1/showdowns/:id/vote - Cast a vote in showdown
showdownRouter.post('/:id/vote', ShowdownController.vote);
