import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { productRouter } from './routes/products.js';
import { authRouter } from './routes/auth.js';
import { walletRouter } from './routes/wallet.js';
import { checkoutRouter } from './routes/checkout.js';
import { cryptoRouter } from './routes/crypto.js';
import { agentRouter } from './routes/agent.js';
import { showdownRouter } from './routes/showdowns.js';
import { reviewRouter } from './routes/reviews.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { analyticsRouter } from './routes/analytics.js';
import { LedgerWatcherWorker } from './workers/ledgerWatcher.js';
import { SocketService } from './sockets/server.js';
import { KeepAliveWorker } from './workers/keepAlive.js';
import { WebhookDlqWorker } from './workers/webhookDlq.js';
import superPlatformRouter from './routes/superPlatform.js';
import { cartRouter } from './routes/cart.js';
import { ordersRouter } from './routes/orders.js';
import { guideRouter } from './routes/guide.js';
import { adminRouter } from './routes/admin.js';
import { stripeWebhookHandler, webhooksRouter } from './routes/webhooks.js';
import { rwaGoldRouter } from './routes/rwaGold.js';
import { rwaModularRouter } from './routes/rwa/rwaModularRouter.js';
import { swapRouter } from './routes/swap.js';
import type { HealthResponse } from '@nexusrail/shared';

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
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);
app.use(express.json());

// Routes
app.use('/api/v1/products', productRouter);
app.use('/api/v1/products', reviewRouter);
app.use('/api/v1/products', leaderboardRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/wallet', walletRouter);
app.use('/api/v1/checkout', checkoutRouter);
app.use('/api/v1/crypto', cryptoRouter);
app.use('/api/v1/agent', agentRouter);
app.use('/api/v1/showdowns', showdownRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/superplatform', superPlatformRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/guide', guideRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/webhooks', webhooksRouter);
app.use('/api/v1/rwa', rwaGoldRouter);
app.use('/api/v1/rwa-modular', rwaModularRouter);
app.use('/api/v1/swap', swapRouter);

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
    name: 'NexusRail Core API Engine',
    status: 'online',
    healthCheck: '/api/v1/health',
  });
});

// Structured JSON 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'API Route Not Found' });
});

// Structured Global JSON Error Handler (Sanitized for Production)
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('❌ [NexusRail API Error]:', err);
  const isProd = env.NODE_ENV === 'production';
  const statusCode = typeof err.status === 'number' ? err.status : 500;
  res.status(statusCode).json({
    success: false,
    error: isProd && statusCode >= 500
      ? 'An unexpected internal error occurred. Please contact system support.'
      : err.message || 'Internal Server Error',
  });
});

app.listen(env.PORT, () => {
  console.log(`🚀 [NexusRail API] Server listening on http://localhost:${env.PORT}`);
  LedgerWatcherWorker.startWatchers();
  SocketService.initializeSockets();
  KeepAliveWorker.startKeepAlive();
  WebhookDlqWorker.startWorker();
});

export default app;
