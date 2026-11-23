import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { AdminController } from '../controllers/admin.controller.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

// Core Dashboard & Analytics
adminRouter.get('/stats', AdminController.getStats);
adminRouter.get('/analytics', AdminController.getAnalytics);

// Dynamic Platform & Network Settings (DB-driven)
adminRouter.get('/platform/settings', AdminController.getPlatformSettings);
adminRouter.patch('/platform/settings', AdminController.updatePlatformSettings);

// Orders & Swaps
adminRouter.get('/orders', AdminController.getOrders);
adminRouter.patch('/orders/:id', AdminController.patchOrder);
adminRouter.get('/swaps', AdminController.getSwaps);
adminRouter.post('/orders/:id/resolve-underpaid', AdminController.resolveUnderpaidOrder);

// Marketing & Coupons
adminRouter.get('/coupons', AdminController.getCoupons);
adminRouter.post('/coupons', AdminController.upsertCoupon);

// AI Agent Telemetry
adminRouter.get('/agent-telemetry', AdminController.getAgentTelemetry);

// Products & Catalog
adminRouter.get('/products', AdminController.getProducts);
adminRouter.post('/products', AdminController.createProduct);
adminRouter.patch('/products/:sku', AdminController.patchProduct);

// User Management
adminRouter.get('/users', AdminController.getUsers);

// Dual-Rail Token Pool & Reserves ($NXL / $NR)
adminRouter.get(['/nr-pool', '/nr-token/status', '/nxl-token/status'], AdminController.getPoolStatus);
adminRouter.post(['/nr-pool/adjust-reserve', '/nr-token/reserve', '/nxl-token/reserve'], AdminController.adjustReserve);
adminRouter.get('/portfolios', AdminController.getPortfolios);

// Treasury Governance
adminRouter.get('/treasury/summary', AdminController.getTreasurySummary);
adminRouter.get('/treasury/entries', AdminController.getTreasuryEntries);
adminRouter.get('/treasury/config', AdminController.getTreasuryConfig);
adminRouter.patch('/treasury/config', AdminController.patchTreasuryConfig);
adminRouter.post('/treasury/trigger-split', AdminController.triggerTreasurySplit);

// On-Chain Soroban Vault Contracts
adminRouter.get('/contracts/nexus-vault', AdminController.getNexusVault);
adminRouter.get('/contracts/live', AdminController.getLiveContracts);
adminRouter.post('/contracts/nexus-vault/mint-nxl', AdminController.mintVaultNxl);
adminRouter.post('/contracts/nexus-vault/burn-nxl', AdminController.burnVaultNxl);
adminRouter.post('/contracts/nexus-vault/upgrade', AdminController.upgradeVault);

// Dual-Rail XRPL & Stellar Infrastructure
adminRouter.get('/tokens/nr', AdminController.getNrToken);
adminRouter.get(['/dual-rail/status', '/dual-rail/summary'], AdminController.getDualRailStatus);
adminRouter.post('/dual-rail/xrpl-amm/create', AdminController.createXrplAmm);
adminRouter.post('/dual-rail/xrpl-amm/deposit', AdminController.depositXrplAmm);
adminRouter.get('/dual-rail/logs', AdminController.getDualRailLogs);
adminRouter.get('/dual-rail/credentials', AdminController.getDualRailCredentials);
