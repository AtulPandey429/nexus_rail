import { Router } from 'express';
import { CryptoController } from '../controllers/crypto.controller.js';

export const cryptoRouter = Router();

// GET /api/v1/crypto/rates - Get live exchange rates for USD, XRP, XLM
cryptoRouter.get('/rates', CryptoController.getRates);

// GET /api/v1/crypto/providers - Discover all registered multi-chain providers
cryptoRouter.get('/providers', CryptoController.getProviders);

// GET /api/v1/crypto/balance/:chain - Fetch live account balance
cryptoRouter.get('/balance/:chain', CryptoController.getBalance);

// GET /api/v1/crypto/verify/:chain/:txHash - Direct transaction verification
cryptoRouter.get('/verify/:chain/:txHash', CryptoController.verifyTransaction);

// POST /api/v1/crypto/nr/withdraw & /nxl/withdraw - 1-Click On-Chain Token Withdrawal
cryptoRouter.post('/nr/withdraw', CryptoController.withdrawToken);
cryptoRouter.post('/nxl/withdraw', CryptoController.withdrawToken);
