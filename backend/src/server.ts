import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { stripeWebhookHandler } from './routes/webhooks.routes.js';
import { LedgerWatcherWorker } from './workers/ledgerWatcher.js';
import { SocketService } from './sockets/server.js';
import { KeepAliveWorker } from './workers/keepAlive.js';
import { WebhookDlqWorker } from './workers/webhookDlq.js';
import type { HealthResponse } from './types/index.js';

const app = express();
const startTime = Date.now();

const isAllowedOrigin = (origin: string): boolean => {
  if (!origin) return true;
  if (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') return true;
  if (env.CORS_ORIGIN && (origin === env.CORS_ORIGIN || origin.startsWith(env.CORS_ORIGIN))) return true;
  if (env.APP_URL && (origin === env.APP_URL || origin.startsWith(env.APP_URL))) return true;
  // Authorize all Vercel production and preview deployment URLs
  if (origin.endsWith('.vercel.app') || origin.includes('vercel.app')) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin) || env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      const err: any = new Error(`CORS policy violation: Origin "${origin}" is not authorized`);
      err.status = 403;
      return callback(err);
    },
    credentials: true,
  })
);

// Raw body parser specifically for Stripe webhook signature verification
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);
app.use(express.json());

// Centralized API v1 Routes (GamersGold Architecture)
app.use('/api/v1', apiRouter);

// Health Check Endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'nexusrail-api', uptimeSeconds: Math.floor((Date.now() - startTime) / 1000) });
});

app.get('/api/v1/health', (_req: Request, res: Response) => {
  const payload: HealthResponse = {
    status: 'ok',
    service: 'nexusrail-api',
    version: '1.0.0',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(payload);
});

// Root welcome route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'nexusrail-api',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      apiHealth: '/api/v1/health',
      platformConfig: '/api/v1/platform/config',
      products: '/api/v1/products',
      cryptoRates: '/api/v1/crypto/rates',
      tokenStatus: '/api/v1/nr-token/status',
    },
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

export default app;

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(env.PORT, () => {
    console.log(`NexusRail Server running on port ${env.PORT}`);
    console.log(`CORS authorized origins: ${env.CORS_ORIGIN || '*'}`);
    console.log(`API Platform Config: http://localhost:${env.PORT}/api/v1/platform/config`);

    try {
      SocketService.initializeSockets();
    } catch (err: any) {
      console.warn('⚠️ [SocketService] WebSocket init warning:', err?.message || err);
    }

    try {
      LedgerWatcherWorker.startWatchers();
    } catch (err: any) {
      console.warn('⚠️ [LedgerWatcherWorker] Worker start warning:', err?.message || err);
    }

    try {
      KeepAliveWorker.startKeepAlive();
    } catch (err: any) {
      console.warn('⚠️ [KeepAliveWorker] Worker start warning:', err?.message || err);
    }

    try {
      WebhookDlqWorker.startWorker();
    } catch (err: any) {
      console.warn('⚠️ [WebhookDlqWorker] Worker start warning:', err?.message || err);
    }
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      console.log('Server gracefully shut down');
      process.exit(0);
    });
  });
}
