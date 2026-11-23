import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { productRouter } from './products.routes.js';
import { cartRouter } from './cart.routes.js';
import { ordersRouter } from './orders.routes.js';
import { checkoutRouter } from './checkout.routes.js';
import { swapRouter } from './swap.routes.js';
import { walletRouter } from './wallet.routes.js';
import { portfolioRouter } from './portfolio.routes.js';
import { cryptoRouter } from './crypto.routes.js';
import { platformRouter } from './platform.routes.js';
import { analyticsRouter } from './analytics.routes.js';
import { adminRouter } from './admin.routes.js';
import { agentRouter } from './agent.routes.js';
import { userRouter } from './user.routes.js';
import { webhooksRouter } from './webhooks.routes.js';
import { guideRouter } from './guide.routes.js';
import { showdownRouter } from './showdowns.routes.js';
import { TokenController } from '../controllers/token.controller.js';

const router = Router();

/**
 * Centralized Route Registry (GamersGold / Clean Architecture Pattern)
 *
 * Each domain has its own dedicated `.routes.ts` file and is registered
 * under its semantic path prefix (e.g. /crypto, /checkout, /products).
 */
const defaultRoutes = [
  { path: '/auth', route: authRouter },
  { path: '/products', route: productRouter },
  { path: '/cart', route: cartRouter },
  { path: '/orders', route: ordersRouter },
  { path: '/checkout', route: checkoutRouter },
  { path: '/swap', route: swapRouter },
  { path: '/wallet', route: walletRouter },
  { path: '/portfolio', route: portfolioRouter },
  { path: '/crypto', route: cryptoRouter },
  { path: '/platform', route: platformRouter },
  { path: '/analytics', route: analyticsRouter },
  { path: '/admin', route: adminRouter },
  { path: '/agent', route: agentRouter },
  { path: '/user', route: userRouter },
  { path: '/webhooks', route: webhooksRouter },
  { path: '/guide', route: guideRouter },
  { path: '/showdowns', route: showdownRouter },
];

defaultRoutes.forEach((r) => {
  router.use(r.path, r.route);
});

// Public Dual-Rail Token Pool Stats ($NXL / $NR)
router.get(['/nr-token/status', '/nxl-token/status'], TokenController.getPoolStatus);

export default router;
export { defaultRoutes };
