import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CheckoutController } from '../controllers/checkout.controller.js';

export const checkoutRouter = Router();

// Pay order using $NXL balance
checkoutRouter.post('/nr/pay', requireAuth, CheckoutController.payWithToken);
checkoutRouter.post('/nxl/pay', requireAuth, CheckoutController.payWithToken);

// Stripe checkout session
checkoutRouter.post('/stripe/create-session', requireAuth, CheckoutController.createStripeSession);

// Dynamic Multi-Chain Invoice Creation
checkoutRouter.post('/:chain/create-invoice', requireAuth, CheckoutController.createChainInvoice);

// Unified checkout quote
checkoutRouter.get('/quote/:orderId', requireAuth, CheckoutController.getQuote);

// Refresh / Renew Quote Ticket
checkoutRouter.post('/quote/refresh', requireAuth, CheckoutController.refreshQuote);

// Build unsigned Stellar payment XDR for Freighter
checkoutRouter.post(['/stellar/prepare-xdr', '/stellar-usdc/prepare-xdr'], requireAuth, CheckoutController.prepareStellarXdr);

// Submit client-signed XDR to Horizon
checkoutRouter.post('/stellar/submit-xdr', requireAuth, CheckoutController.submitStellarXdr);

// Dynamic Multi-Chain Payment Verification
checkoutRouter.post('/:chain/verify-payment', requireAuth, CheckoutController.verifyPayment);

// Real-Time Settlement SSE Stream
checkoutRouter.get('/orders/:orderId/stream', CheckoutController.streamSettlement);

// IPFS Order Receipt
checkoutRouter.get('/orders/:orderId/ipfs-receipt', requireAuth, CheckoutController.getIpfsReceipt);

// Resolve UNDERPAID slippage order
checkoutRouter.post('/orders/:orderId/resolve-underpaid', requireAuth, CheckoutController.resolveUnderpaid);

// Soroban Smart Contract Atomic Settlement
checkoutRouter.post('/soroban/prepare', requireAuth, CheckoutController.prepareSoroban);
checkoutRouter.post('/soroban/submit', requireAuth, CheckoutController.submitSoroban);
