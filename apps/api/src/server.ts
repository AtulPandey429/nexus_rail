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
import { LedgerWatcherWorker } from './workers/ledgerWatcher.js';
import { SocketService } from './sockets/server.js';
import type { HealthResponse } from '@nexusrail/shared';

const app = express();
const startTime = Date.now();

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/v1/products', productRouter);
app.use('/api/v1/products', reviewRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/wallet', walletRouter);
app.use('/api/v1/checkout', checkoutRouter);
app.use('/api/v1/crypto', cryptoRouter);
app.use('/api/v1/agent', agentRouter);
app.use('/api/v1/showdowns', showdownRouter);

// Health Check Endpoint
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

app.listen(env.PORT, () => {
  console.log(`🚀 [NexusRail API] Server listening on http://localhost:${env.PORT}`);
  LedgerWatcherWorker.startWatchers();
  SocketService.initializeSockets();
});

export default app;
