import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { StripeService } from '../services/stripe.js';
import { IpfsService } from '../services/ipfs.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';
import { chainRegistry } from '../services/crypto/index.js';

export const checkoutRouter = Router();

// POST /api/v1/checkout/stripe/create-session
checkoutRouter.post('/stripe/create-session', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await StripeService.createCheckoutFromCart(req.user!.id);
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
    const invoiceResponse = {
      ...invoice,
      destination: invoice.recipientAddress,
      destinationTag: invoice.paymentIdentifierType === 'destination_tag' ? Number(invoice.paymentIdentifier) : undefined,
      memo: invoice.paymentIdentifierType === 'memo_text' ? String(invoice.paymentIdentifier) : undefined,
      memoType: invoice.paymentIdentifierType === 'memo_text' ? 'text' : undefined,
      amount: String(invoice.amountAsset),
      amountXrp: provider.assetSymbol === 'XRP' ? invoice.amountAsset : undefined,
      amountXlm: provider.assetSymbol === 'XLM' ? String(invoice.amountAsset) : undefined,
    };

    // Save payment details on order
    await ordersCol.updateOne(
      { id: order.id },
      {
        $set: {
          payment_rail: provider.assetSymbol,
          payment_address: invoice.recipientAddress,
          payment_memo: String(invoice.paymentIdentifier),
          updated_at: new Date().toISOString(),
        },
      }
    );

    res.json({ success: true, invoice: invoiceResponse });
  } catch (error: any) {
    res.status(502).json({ success: false, error: error.message || `${chain.toUpperCase()} invoice failed` });
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
