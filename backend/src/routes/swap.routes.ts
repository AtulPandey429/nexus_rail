import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { SwapController } from '../controllers/swap.controller.js';

export const swapRouter = Router();

// Live $NR AMM pool telemetry
swapRouter.get('/nr-pool', SwapController.getNrPool);

// Live swap quote
swapRouter.post('/quote', SwapController.getQuote);

// Initiate swap order
swapRouter.post('/initiate', SwapController.initiateSwap);

// Execute swap deposit/payout
swapRouter.post('/execute', SwapController.executeSwap);

// Stellar Freighter XDR preparation & submission
swapRouter.post('/stellar/prepare-xdr', SwapController.prepareStellarXdr);
swapRouter.post('/stellar/submit-xdr', SwapController.submitStellarXdr);

// Stellar Trustline operations
swapRouter.get('/stellar/trustline-status', SwapController.getStellarTrustlineStatus);
swapRouter.post('/stellar/prepare-trustline-xdr', SwapController.prepareStellarTrustlineXdr);
swapRouter.post('/stellar/set-trustline-secret', SwapController.setStellarTrustlineSecret);

// XRPL Trustline operations & claims
swapRouter.get('/xrpl/trustline-status', SwapController.getXrplTrustlineStatus);
swapRouter.get('/xrpl/pending-claims', requireAuth, SwapController.getXrplPendingClaims);
swapRouter.post('/xrpl/claim-pending', requireAuth, SwapController.claimXrplPending);

// Swap history
swapRouter.get('/history/me', requireAuth, SwapController.getMyHistory);
swapRouter.get('/history', SwapController.getHistory);

// Soroban On-Chain AMM & Bridge Escrow
swapRouter.get('/soroban/pool', SwapController.getSorobanPool);
swapRouter.post('/soroban/quote', SwapController.getSorobanQuote);
swapRouter.post('/soroban/prepare', SwapController.prepareSorobanSwap);
swapRouter.post('/soroban/submit', SwapController.submitSorobanSwap);

// Single Swap status
swapRouter.get('/:swapId', SwapController.getSwapById);
