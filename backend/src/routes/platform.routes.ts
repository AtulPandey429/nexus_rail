import { Router } from 'express';
import { PlatformController } from '../controllers/platform.controller.js';

export const platformRouter = Router();

// GET /api/v1/platform/config - Public, read-only platform configuration
platformRouter.get('/config', PlatformController.getConfig);
