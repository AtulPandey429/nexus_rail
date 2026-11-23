import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { WalletController } from '../controllers/wallet.controller.js';

export const walletRouter = Router();

// User off-chain balance & portfolio
walletRouter.get('/balance', requireAuth, WalletController.getBalance);
walletRouter.get('/portfolio', requireAuth, WalletController.getPortfolio);
walletRouter.post('/portfolio/sell', requireAuth, WalletController.sellHolding);
walletRouter.post('/topup', requireAuth, WalletController.topup);
walletRouter.get('/transactions', requireAuth, WalletController.getTransactions);

// Live on-chain ledger transactions (Stellar / XRPL)
walletRouter.get('/ledger-transactions', WalletController.getLedgerTransactions);
