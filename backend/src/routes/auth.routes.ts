import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AuthController } from '../controllers/auth.controller.js';

export const authRouter = Router();

// Current user profile
authRouter.get('/me', requireAuth, AuthController.getMe);

// Traditional email/password auth
authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);

// Web3 challenge & signature verification
authRouter.post('/nonce', AuthController.createNonce);
authRouter.post('/verify-signature', AuthController.verifySignature);

// Direct wallet connection & manual address auth
authRouter.post('/wallet-login', AuthController.walletLogin);
authRouter.post('/manual-wallet', AuthController.manualWallet);

// Google OAuth
authRouter.post('/google', AuthController.googleLogin);

// Logout
authRouter.post('/logout', AuthController.logout);
