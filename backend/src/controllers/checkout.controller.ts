import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { verifyToken } from '../services/jwt.js';
import { StripeService } from '../services/stripe.js';
import { IpfsService } from '../services/ipfs.js';
import { MongoService, MongoOrderDoc } from '../services/mongo.js';
import { chainRegistry, stellarProvider, stellarUsdcProvider } from '../services/crypto/index.js';
import { settlementEmitter } from '../services/settlementEvents.js';
import { RatesService } from '../services/rates.js';
import { NrTokenService } from '../services/nrToken.service.js';
import { PortfolioService } from '../services/portfolio.service.js';
import { resolveUnderpaidOrder, type UnderpaidResolutionMode } from '../services/underpaidOrder.service.js';
import { SorobanService, NEXUS_VAULT_CONTRACT_ID } from '../services/soroban.js';
import { TreasuryService } from '../services/treasury.service.js';
import { DualRailTokenService } from '../services/dualRailToken.service.js';
import { STELLAR_TESTNET, XRPL_TESTNET } from '../utils/constants.js';

export class CheckoutController {
  /**
   * POST /api/v1/checkout/nr/pay or /nxl/pay
   * Pay order using $NXL balance with 10% discount + 0% fee
   */
  static async payWithToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      res.status(400).json({ success: false, error: 'orderId is required' });
      return;
    }

    try {
      const result = await NrTokenService.payOrderWithNr({
        userId: req.user!.id,
        orderId,
      });
      res.json({
        success: true,
        orderStatus: 'PAID',
        data: result,
      });
    } catch (error: any) {
      const msg = error?.message || '$NXL checkout failed';
      const status = msg.includes('not found')
        ? 404
        : msg.includes('Insufficient')
        ? 402
        : 400;
      res.status(status).json({ success: false, error: msg });
    }
  }

  /**
   * POST /api/v1/checkout/stripe/create-session
   */
  static async createStripeSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const clientUrl = req.body?.clientUrl || (req.headers.origin as string) || (req.headers.referer as string);
      const promoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim() : undefined;
      const session = await StripeService.createCheckoutFromCart(req.user!.id, clientUrl, promoCode);
      res.json({ success: true, data: session });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Stripe checkout failed' });
    }
  }

  /**
   * POST /api/v1/checkout/:chain/create-invoice
   */
  static async createChainInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    const chain = String(req.params.chain || '').toLowerCase();
    const orderId = String(req.body?.orderId || '');

    if (!orderId) {
      res.status(400).json({ success: false, error: 'orderId is required' });
      return;
    }

    try {
      const provider = chainRegistry.getRequiredProvider(chain);
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const order = await ordersCol.findOne({
        $or: [{ id: orderId }, { order_number: orderId }],
        user_id: req.user!.id,
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
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
  }

  /**
   * GET /api/v1/checkout/quote/:orderId
   * Unified checkout quote across Stellar, XRPL, and NXL rails
   */
  static async getQuote(req: AuthenticatedRequest, res: Response): Promise<void> {
    const orderId = String(req.params.orderId || '');
    if (!orderId) {
      res.status(400).json({ success: false, error: 'orderId is required' });
      return;
    }

    try {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const order = await ordersCol.findOne({
        $or: [{ id: orderId }, { order_number: orderId }],
        user_id: req.user!.id,
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }
      if (order.status === 'PAID') {
        res.status(400).json({ success: false, error: 'Order is already settled' });
        return;
      }

      const totalCents = Number(order.total_cents || 0);
      if (!Number.isFinite(totalCents) || totalCents <= 0) {
        res.status(400).json({ success: false, error: 'Order total is invalid' });
        return;
      }

      const rails: Record<string, Record<string, unknown>> = {};
      const errors: Record<string, string> = {};

      await Promise.all(
        (['stellar', 'xrpl'] as const).map(async (chain) => {
          try {
            const provider = chainRegistry.getRequiredProvider(chain);
            const invoice = await provider.createInvoice(order.id, totalCents);
            const railKey = provider.assetSymbol === 'XLM' ? 'STELLAR' : 'XRPL';
            rails[railKey] = {
              rail: railKey,
              chain,
              assetSymbol: provider.assetSymbol,
              amountCrypto: String(invoice.amountAsset),
              fxRateUsd: invoice.fxRateUsd,
              destination: invoice.recipientAddress,
              memo:
                invoice.paymentIdentifierType === 'memo_text'
                  ? String(invoice.paymentIdentifier)
                  : null,
              destinationTag:
                invoice.paymentIdentifierType === 'destination_tag'
                  ? Number(invoice.paymentIdentifier)
                  : null,
              networkIdentifier:
                chain === 'stellar'
                  ? STELLAR_TESTNET.networkPassphrase
                  : env.XRPL_TESTNET_WSS || env.XRPL_WSS || XRPL_TESTNET.wss,
              expiresAt: invoice.expiresAt,
              explorerUrl: invoice.explorerUrl,
              totalCents,
              discountCents: order.discount_cents ?? 0,
            };
          } catch (err: any) {
            errors[chain] = err?.message || `${chain.toUpperCase()} quote failed`;
          }
        })
      );

      try {
        const [config, pool] = await Promise.all([
          TreasuryService.getConfig(),
          NrTokenService.getPoolStats(),
        ]);
        const discountPct = Math.max(0, Math.min(50, Number(config.nxl_checkout_discount_pct ?? 0)));
        const discountCents = Math.round(totalCents * (discountPct / 100));
        const payableCents = totalCents >= 100
          ? Math.max(100, totalCents - discountCents)
          : Math.max(1, totalCents - discountCents);

        if (!(pool.spotPriceUsd > 0)) {
          throw new Error('NXL spot price is unavailable');
        }

        rails.NXL = {
          rail: 'NXL',
          chain: 'nxl',
          assetSymbol: 'NXL',
          amountCrypto: (payableCents / 100 / pool.spotPriceUsd).toFixed(6),
          fxRateUsd: pool.spotPriceUsd,
          destination: null,
          memo: null,
          destinationTag: null,
          networkIdentifier: 'NXL AMM settlement',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          explorerUrl: null,
          totalCents: payableCents,
          originalTotalCents: totalCents,
          discountCents,
          discountPct,
          swapFeePercent: pool.swapFeePercent,
        };
      } catch (err: any) {
        errors.nxl = err?.message || 'NXL quote failed';
      }

      res.json({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          status: order.status,
          subtotalCents: order.subtotal_cents ?? totalCents,
          discountCents: order.discount_cents ?? 0,
          totalCents,
          rails,
          errors,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Could not build checkout quote' });
    }
  }

  /**
   * POST /api/v1/checkout/quote/refresh
   */
  static async refreshQuote(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { orderId, chain } = req.body || {};
    if (!orderId) {
      res.status(400).json({ success: false, error: 'orderId is required' });
      return;
    }

    try {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const order = await ordersCol.findOne({
        $or: [{ id: orderId }, { order_number: orderId }],
        user_id: req.user!.id,
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      if (order.status === 'PAID') {
        res.status(400).json({ success: false, error: 'Order is already settled' });
        return;
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
  }

  /**
   * POST /api/v1/checkout/stellar/prepare-xdr or /stellar-usdc/prepare-xdr
   */
  static async prepareStellarXdr(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { orderId, sourcePublicKey } = req.body || {};
    if (!orderId || !sourcePublicKey) {
      res.status(400).json({ success: false, error: 'orderId and sourcePublicKey are required' });
      return;
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
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
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
        networkPassphrase: STELLAR_TESTNET.networkPassphrase,
      });
    } catch (error: any) {
      res.status(502).json({ success: false, error: error.message || 'Failed to prepare Stellar XDR' });
    }
  }

  /**
   * POST /api/v1/checkout/stellar/submit-xdr
   */
  static async submitStellarXdr(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const { signedXdr } = _req.body || {};
    if (!signedXdr) {
      res.status(400).json({ success: false, error: 'signedXdr is required' });
      return;
    }

    try {
      const result = await stellarProvider.submitSignedXdr(signedXdr);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(502).json({ success: false, error: error.message || 'Horizon submission rejected' });
    }
  }

  /**
   * POST /api/v1/checkout/:chain/verify-payment
   */
  static async verifyPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    const chain = String(req.params.chain || '').toLowerCase();
    const orderId = String(req.body?.orderId || '');
    const txHash = String(req.body?.txHash || '');

    if (!orderId || !txHash) {
      res.status(400).json({ success: false, error: 'orderId and txHash are required' });
      return;
    }

    try {
      const provider = chainRegistry.getRequiredProvider(chain);
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const order = await ordersCol.findOne({
        $or: [{ id: orderId }, { order_number: orderId }],
        user_id: req.user!.id,
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      const verification = await provider.verifyPayment(order.id, txHash);

      if (verification.verified) {
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
                  sender_wallet_address: verification.sourceAddress,
                  delivered_crypto_amount: verification.amountDelivered,
                  updated_at: new Date().toISOString(),
                },
              }
            );

            res.status(400).json({
              success: false,
              error: `Payment received on ledger, but quote ticket expired with ${slippage.slippagePercent.toFixed(1)}% adverse slippage. Order quarantined as UNDERPAID. Additional ${underpaidCents} cents required.`,
              orderStatus: 'UNDERPAID',
              slippagePercent: slippage.slippagePercent,
              underpaidCents,
            });
            return;
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

        settlementEmitter.emitSettlement({
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'PAID',
          paymentRail: provider.assetSymbol,
          txHash,
          timestamp: new Date().toISOString(),
        });

        try {
          await PortfolioService.creditOrderAllocations(order);
        } catch (portErr: any) {
          console.warn('⚠️ [checkoutController] Portfolio crediting warning:', portErr.message);
        }
      }

      res.json({
        success: verification.verified,
        data: verification,
        orderStatus: verification.verified ? 'PAID' : order.status,
      });
    } catch (error: any) {
      res.status(502).json({ success: false, error: error.message || 'Payment verification failed' });
    }
  }

  /**
   * GET /api/v1/checkout/orders/:orderId/stream
   */
  static async streamSettlement(req: Request, res: Response): Promise<void> {
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
      res.status(401).json({ success: false, error: 'Authentication required for settlement stream' });
      return;
    }

    try {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const order = await ordersCol.findOne({
        $or: [{ id: orderId }, { order_number: orderId }],
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      if (order.user_id !== userId && userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Forbidden: You do not own this order' });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders?.();

      if (order.status === 'PAID') {
        res.write(`event: settlement\ndata: ${JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'PAID',
          paymentRail: order.payment_rail,
          txHash: order.tx_hash,
          timestamp: order.updated_at || new Date().toISOString(),
        })}\n\n`);
        res.end();
        return;
      }

      res.write(`event: status\ndata: ${JSON.stringify({
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentRail: order.payment_rail,
      })}\n\n`);

      const unsubscribe = settlementEmitter.onSettlement(order.id, (event) => {
        res.write(`event: settlement\ndata: ${JSON.stringify(event)}\n\n`);
        setTimeout(() => {
          try {
            res.end();
          } catch {}
        }, 500);
      });

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
  }

  /**
   * GET /api/v1/checkout/orders/:orderId/ipfs-receipt
   */
  static async getIpfsReceipt(req: AuthenticatedRequest, res: Response): Promise<void> {
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    try {
      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const order = await ordersCol.findOne({
        $or: [{ id: orderId }, { order_number: orderId }],
        user_id: req.user!.id,
      });

      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }

      if (order.ipfs_cid) {
        res.json({
          success: true,
          receipt: { orderId: order.id, ipfsHash: order.ipfs_cid, gatewayUrl: `https://gateway.pinata.cloud/ipfs/${order.ipfs_cid}` },
        });
        return;
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
  }

  /**
   * POST /api/v1/checkout/orders/:orderId/resolve-underpaid
   */
  static async resolveUnderpaid(req: AuthenticatedRequest, res: Response): Promise<void> {
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    const rawMode = String(req.body?.mode || '').toUpperCase().trim() as UnderpaidResolutionMode;
    const allowedModes: UnderpaidResolutionMode[] = ['TOPUP_USD', 'TOPUP_NXL', 'REFUND_ONCHAIN', 'REFUND_WALLET'];

    if (!allowedModes.includes(rawMode)) {
      res.status(400).json({
        success: false,
        error: `Please choose a valid option: ${allowedModes.join(', ')}`,
      });
      return;
    }

    try {
      const result = await resolveUnderpaidOrder({
        orderId,
        userId: req.user!.id,
        mode: rawMode,
        isAdmin: req.user?.role === 'admin',
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      const msg = error?.message || 'Could not resolve underpaid order';
      const status = msg.includes('not found')
        ? 404
        : msg.includes('Insufficient')
        ? 402
        : 400;
      res.status(status).json({ success: false, error: msg });
    }
  }

  /**
   * POST /api/v1/checkout/soroban/prepare
   */
  static async prepareSoroban(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const orderId = String(req.body?.orderId || '').trim();
      const payerAddress = String(req.body?.payerAddress || '').trim();
      const tokenAsset = String(req.body?.tokenAsset || 'XLM').toUpperCase() === 'NXL' ? 'NXL' : 'XLM';

      if (!orderId || !payerAddress) {
        res.status(400).json({ success: false, error: 'orderId and payerAddress (Stellar G... public key) are required' });
        return;
      }

      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const order = await ordersCol.findOne({
        $or: [{ id: orderId }, { order_number: orderId }],
        user_id: req.user!.id,
      });
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }
      if (order.status === 'PAID' || order.status === 'FULFILLED') {
        res.status(400).json({ success: false, error: 'Order is already paid' });
        return;
      }

      let grossAmount = Number(req.body?.amount || 0);
      if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
        const ticket = await RatesService.generateQuoteTicket(order.id, order.total_cents, tokenAsset);
        grossAmount = Number(ticket.cryptoAmount);
      }

      const prepared = await SorobanService.buildSettleOrderXdr({
        payerAddress,
        tokenAsset,
        grossAmount,
        orderId: order.id,
      });

      res.json({
        success: true,
        data: {
          ...prepared,
          orderId: order.id,
          tokenAsset,
          grossAmount,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error?.message || 'Failed to prepare Soroban settlement transaction',
      });
    }
  }

  /**
   * POST /api/v1/checkout/soroban/submit
   */
  static async submitSoroban(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const orderId = String(req.body?.orderId || '').trim();
      const signedXdr = String(req.body?.signedXdr || '').trim();
      const tokenAsset = String(req.body?.tokenAsset || 'XLM').toUpperCase() === 'NXL' ? 'NXL' : 'XLM';

      if (!orderId || !signedXdr) {
        res.status(400).json({ success: false, error: 'orderId and signedXdr are required' });
        return;
      }

      const ordersCol = await MongoService.getCollection<MongoOrderDoc>('orders');
      const order = await ordersCol.findOne({
        $or: [{ id: orderId }, { order_number: orderId }],
        user_id: req.user!.id,
      });
      if (!order) {
        res.status(404).json({ success: false, error: 'Order not found' });
        return;
      }
      if (order.status === 'PAID' || order.status === 'FULFILLED') {
        res.json({ success: true, alreadyPaid: true, orderId: order.id, txHash: order.tx_hash });
        return;
      }

      const txRes = await SorobanService.submitSignedSorobanXdr(signedXdr);

      const onChainRecord = await SorobanService.getOnChainOrder(order.id).catch(() => null);
      if (!onChainRecord) {
        res.status(400).json({
          success: false,
          error: 'Transaction succeeded but order settlement record was not found in NexusVault',
        });
        return;
      }

      const paidAt = new Date().toISOString();
      const paidAmount = Number(onChainRecord.gross_amount || 0) / 1e7;

      await ordersCol.updateOne(
        { id: order.id },
        {
          $set: {
            status: 'PAID',
            payment_rail: tokenAsset === 'NXL' ? 'NXL' : 'XLM',
            tx_hash: txRes.txHash,
            paid_at: paidAt,
            updated_at: paidAt,
            payment_verification_details: {
              contractId: NEXUS_VAULT_CONTRACT_ID,
              method: 'settle_order',
              ledger: txRes.ledger,
              explorerUrl: txRes.explorerUrl,
              onChainRecord,
            },
          },
        }
      );

      const feeCents = Math.max(1, Math.round(order.total_cents * 0.01));
      await TreasuryService.recordRevenueEvent({
        sourceType: 'ORDER',
        referenceId: order.id,
        grossCents: order.total_cents,
        feeCents,
        rail: tokenAsset === 'NXL' ? 'NXL' : 'STELLAR',
      }).catch(() => {});

      await DualRailTokenService.logChainAction({
        chain: 'STELLAR',
        action: 'CONTRACT_SPLIT',
        operatorId: req.user!.id,
        referenceId: order.id,
        txHash: txRes.txHash,
        ledgerSeq: txRes.ledger,
        amountPrimary: paidAmount,
        details: {
          contract: NEXUS_VAULT_CONTRACT_ID,
          method: 'settle_order',
          tokenAsset,
          principal: Number(onChainRecord.principal || 0) / 1e7,
          ownerShare: Number(onChainRecord.owner_share || 0) / 1e7,
          nrShare: Number(onChainRecord.nr_share || 0) / 1e7,
        },
      }).catch(() => {});

      const updatedOrder = (await ordersCol.findOne({ id: order.id })) || order;
      await PortfolioService.creditOrderAllocations(updatedOrder).catch((err) => {
        console.warn('[SorobanCheckout] Portfolio credit warning:', err?.message);
      });

      settlementEmitter.emitSettlement({
        orderId: order.id,
        orderNumber: order.order_number,
        status: 'PAID',
        paymentRail: tokenAsset,
        txHash: txRes.txHash,
        timestamp: paidAt,
      });

      res.json({
        success: true,
        orderStatus: 'PAID',
        data: {
          orderId: order.id,
          txHash: txRes.txHash,
          ledger: txRes.ledger,
          explorerUrl: txRes.explorerUrl,
          contractId: NEXUS_VAULT_CONTRACT_ID,
          onChainRecord,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error?.message || 'Soroban checkout submission failed',
      });
    }
  }
}
