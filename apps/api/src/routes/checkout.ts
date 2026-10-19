import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { verifyToken } from '../services/jwt.js';
import { StripeService } from '../services/stripe.js';
import { IpfsService } from '../services/ipfs.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';
import { chainRegistry, stellarProvider, stellarUsdcProvider } from '../services/crypto/index.js';
import { settlementEmitter } from '../services/settlementEvents.js';
import { RatesService } from '../services/rates.js';

export const checkoutRouter = Router();

// POST /api/v1/checkout/stripe/create-session
checkoutRouter.post('/stripe/create-session', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clientUrl = req.body?.clientUrl || (req.headers.origin as string) || (req.headers.referer as string);
    const session = await StripeService.createCheckoutFromCart(req.user!.id, clientUrl);
    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Stripe checkout failed' });
  }
});

// Dynamic Multi-Chain Invoice Creation: POST /api/v1/checkout/:chain/create-invoice
checkoutRouter.post('/:chain/create-invoice', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const chain = String(req.params.chain || '').toLowerCase();
  const orderId = String(req.body?.orderId || '');

  if (!orderId) {
    return res.status(400).json({ success: false, error: 'orderId is required' });
  }

  try {
    const provider = chainRegistry.getRequiredProvider(chain);
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [{ id: orderId }, { order_number: orderId }],
      user_id: req.user!.id,
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const invoice = await provider.createInvoice(order.id, order.total_cents);
    const quoteTicket = await RatesService.generateQuoteTicket(
      order.id,
      order.total_cents,
      provider.assetSymbol
    );

    const invoiceResponse = {
      ...invoice,
      destination: invoice.recipientAddress,
      destinationTag: invoice.paymentIdentifierType === 'destination_tag' ? Number(invoice.paymentIdentifier) : undefined,
      memo: invoice.paymentIdentifierType === 'memo_text' ? String(invoice.paymentIdentifier) : undefined,
      memoType: invoice.paymentIdentifierType === 'memo_text' ? 'text' : undefined,
      amount: String(invoice.amountAsset),
      amountXrp: provider.assetSymbol === 'XRP' ? invoice.amountAsset : undefined,
      amountXlm: provider.assetSymbol === 'XLM' ? String(invoice.amountAsset) : undefined,
      quoteTicket,
      expiresAt: quoteTicket.expiresAt,
    };

    // Save payment details on order
    await ordersCol.updateOne(
      { id: order.id },
      {
        $set: {
          payment_rail: provider.assetSymbol,
          payment_address: invoice.recipientAddress,
          payment_memo: String(invoice.paymentIdentifier),
          quote_ticket: quoteTicket,
          updated_at: new Date().toISOString(),
        },
      }
    );

    res.json({ success: true, invoice: invoiceResponse });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message || `${chain.toUpperCase()} invoice failed` });
  }
});

// Refresh / Renew Quote Ticket: POST /api/v1/checkout/quote/refresh
checkoutRouter.post('/quote/refresh', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { orderId, chain } = req.body || {};
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'orderId is required' });
  }

  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [{ id: orderId }, { order_number: orderId }],
      user_id: req.user!.id,
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.status === 'PAID') {
      return res.status(400).json({ success: false, error: 'Order is already settled' });
    }

    const targetChain = String(chain || order.payment_rail || 'XLM').toLowerCase();
    const provider = chainRegistry.getRequiredProvider(targetChain);

    const quoteTicket = await RatesService.generateQuoteTicket(
      order.id,
      order.total_cents,
      provider.assetSymbol
    );

    await ordersCol.updateOne(
      { id: order.id },
      {
        $set: {
          quote_ticket: quoteTicket,
          updated_at: new Date().toISOString(),
        },
      }
    );

    res.json({
      success: true,
      quoteTicket,
      amount: String(quoteTicket.cryptoAmount),
      amountXrp: provider.assetSymbol === 'XRP' ? quoteTicket.cryptoAmount : undefined,
      amountXlm: provider.assetSymbol === 'XLM' ? String(quoteTicket.cryptoAmount) : undefined,
      expiresAt: quoteTicket.expiresAt,
    });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message || 'Quote refresh failed' });
  }
});

// Build unsigned Stellar payment XDR for Freighter: POST /api/v1/checkout/stellar/prepare-xdr or /stellar-usdc/prepare-xdr
checkoutRouter.post(['/stellar/prepare-xdr', '/stellar-usdc/prepare-xdr'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { orderId, sourcePublicKey } = req.body || {};
  if (!orderId || !sourcePublicKey) {
    return res.status(400).json({ success: false, error: 'orderId and sourcePublicKey are required' });
  }

  const isUsdc = req.path.includes('stellar-usdc') || req.body?.rail === 'STELLAR_USDC' || req.body?.asset === 'USDC';
  const provider = isUsdc ? stellarUsdcProvider : stellarProvider;

  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [{ id: orderId }, { order_number: orderId }],
      user_id: req.user!.id,
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const invoice = await provider.createInvoice(order.id, order.total_cents);
    const xdr = await provider.buildPaymentXdr(
      sourcePublicKey,
      invoice.amountAsset,
      String(invoice.paymentIdentifier)
    );

    res.json({
      success: true,
      xdr,
      destination: invoice.recipientAddress,
      amount: invoice.amountAsset,
      amountXlm: !isUsdc ? invoice.amountAsset : undefined,
      amountUsdc: isUsdc ? invoice.amountAsset : undefined,
      assetSymbol: provider.assetSymbol,
      memo: invoice.paymentIdentifier,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message || 'Failed to prepare Stellar XDR' });
  }
});

// Submit client-signed XDR to Horizon: POST /api/v1/checkout/stellar/submit-xdr
checkoutRouter.post('/stellar/submit-xdr', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  const { signedXdr } = _req.body || {};
  if (!signedXdr) {
    return res.status(400).json({ success: false, error: 'signedXdr is required' });
  }

  try {
    const result = await stellarProvider.submitSignedXdr(signedXdr);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message || 'Horizon submission rejected' });
  }
});

// Dynamic Multi-Chain Payment Verification: POST /api/v1/checkout/:chain/verify-payment
checkoutRouter.post('/:chain/verify-payment', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const chain = String(req.params.chain || '').toLowerCase();
  const orderId = String(req.body?.orderId || '');
  const txHash = String(req.body?.txHash || '');

  if (!orderId || !txHash) {
    return res.status(400).json({ success: false, error: 'orderId and txHash are required' });
  }

  try {
    const provider = chainRegistry.getRequiredProvider(chain);
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [{ id: orderId }, { order_number: orderId }],
      user_id: req.user!.id,
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const verification = await provider.verifyPayment(order.id, txHash);

    if (verification.verified) {
      // FEAT-02: Cryptographic Quote Ticket Slippage Guard
      if (order.quote_ticket) {
        const rates = await RatesService.getExchangeRates();
        const currentRate = provider.assetSymbol === 'XRP' ? rates.XRP : rates.XLM;
        const slippage = RatesService.evaluateSlippage(order.quote_ticket, currentRate, 1.5);

        if (!slippage.isAcceptable) {
          const underpaidCents = Math.max(0, order.total_cents - slippage.deliveredUsdCents);
          await ordersCol.updateOne(
            { id: order.id },
            {
              $set: {
                status: 'UNDERPAID',
                tx_hash: txHash,
                payment_rail: provider.assetSymbol,
                slippage_percent: slippage.slippagePercent,
                underpaid_cents: underpaidCents,
                updated_at: new Date().toISOString(),
              },
            }
          );

          return res.status(400).json({
            success: false,
            error: `Payment received on ledger, but quote ticket expired with ${slippage.slippagePercent.toFixed(1)}% adverse slippage. Order quarantined as UNDERPAID. Additional ${underpaidCents} cents required.`,
            orderStatus: 'UNDERPAID',
            slippagePercent: slippage.slippagePercent,
            underpaidCents,
          });
        }
      }

      await ordersCol.updateOne(
        { id: order.id },
        {
          $set: {
            status: 'PAID',
            tx_hash: txHash,
            payment_rail: provider.assetSymbol,
            updated_at: new Date().toISOString(),
          },
        }
      );

      // Broadcast real-time settlement event to connected SSE streams
      settlementEmitter.emitSettlement({
        orderId: order.id,
        orderNumber: order.order_number,
        status: 'PAID',
        paymentRail: provider.assetSymbol,
        txHash,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: verification.verified,
      data: verification,
      orderStatus: verification.verified ? 'PAID' : order.status,
    });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message || 'Payment verification failed' });
  }
});

// Real-Time Settlement SSE Stream: GET /api/v1/checkout/orders/:orderId/stream
checkoutRouter.get('/orders/:orderId/stream', async (req, res: Response) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;

  let userId: string | null = null;
  let userRole: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = verifyToken(authHeader.slice('Bearer '.length).trim());
      userId = decoded.id;
      userRole = decoded.role;
    } catch {}
  } else if (queryToken) {
    try {
      const decoded = verifyToken(queryToken);
      userId = decoded.id;
      userRole = decoded.role;
    } catch {}
  }

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required for settlement stream' });
  }

  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [{ id: orderId }, { order_number: orderId }],
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not own this order' });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    // If order is already settled, emit settlement immediately and close
    if (order.status === 'PAID') {
      res.write(`event: settlement\ndata: ${JSON.stringify({
        orderId: order.id,
        orderNumber: order.order_number,
        status: 'PAID',
        paymentRail: order.payment_rail,
        txHash: order.tx_hash,
        timestamp: order.updated_at || new Date().toISOString(),
      })}\n\n`);
      return res.end();
    }

    // Emit initial status
    res.write(`event: status\ndata: ${JSON.stringify({
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentRail: order.payment_rail,
    })}\n\n`);

    // Subscribe to real-time settlement events
    const unsubscribe = settlementEmitter.onSettlement(order.id, (event) => {
      res.write(`event: settlement\ndata: ${JSON.stringify(event)}\n\n`);
      setTimeout(() => {
        try {
          res.end();
        } catch {}
      }, 500);
    });

    // Keepalive ping to prevent proxy connection drops
    const keepalive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepalive);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepalive);
      unsubscribe();
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message || 'Stream error' });
    } else {
      res.end();
    }
  }
});

// GET /api/v1/checkout/orders/:orderId/ipfs-receipt
checkoutRouter.get('/orders/:orderId/ipfs-receipt', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  try {
    const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
    const order = await ordersCol.findOne({
      $or: [{ id: orderId }, { order_number: orderId }],
      user_id: req.user!.id,
    });

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    if (order.ipfs_cid) {
      return res.json({
        success: true,
        receipt: { orderId: order.id, ipfsHash: order.ipfs_cid, gatewayUrl: `https://gateway.pinata.cloud/ipfs/${order.ipfs_cid}` },
      });
    }

    const receipt = await IpfsService.pinOrderReceipt(order.id, {
      orderNumber: order.order_number,
      status: order.status,
      totalCents: order.total_cents,
      rail: order.payment_rail,
      txHash: order.tx_hash,
    });

    await ordersCol.updateOne({ id: order.id }, { $set: { ipfs_cid: receipt.ipfsCid } });
    res.json({ success: true, receipt: { orderId: order.id, ipfsHash: receipt.ipfsCid, gatewayUrl: receipt.gatewayUrl } });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message || 'Could not pin receipt' });
  }
});
