import { Request, Response } from 'express';
import { Client, dropsToXrp } from 'xrpl';
import { Horizon } from '@stellar/stellar-sdk';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { walletService } from '../services/wallet.js';
import { PortfolioService } from '../services/portfolio.service.js';
import { env } from '../config/env.js';
import { STELLAR_TESTNET, XRPL_TESTNET } from '../utils/constants.js';
import type { AssetSymbol } from '../types/index.js';

export class WalletController {
  /**
   * GET /api/v1/wallet/balance
   */
  static async getBalance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      res.json({ success: true, balance: await walletService.getBalance(req.user!.id) });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch balance' });
    }
  }

  /**
   * GET /api/v1/wallet/portfolio
   */
  static async getPortfolio(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const portfolio = await PortfolioService.getUserPortfolio(req.user!.id);
      res.json({ success: true, data: portfolio });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error?.message || 'Failed to fetch portfolio' });
    }
  }

  /**
   * POST /api/v1/wallet/portfolio/sell
   */
  static async sellHolding(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const symbol = String(req.body?.symbol || '').trim().toUpperCase() as AssetSymbol;
      const quantity = Number(req.body?.quantity);
      if (!symbol || !quantity || isNaN(quantity) || quantity <= 0) {
        res.status(400).json({ success: false, error: 'Valid symbol and positive quantity are required' });
        return;
      }
      const result = await PortfolioService.sellHolding(req.user!.id, { symbol, quantity });
      res.json({ success: true, data: result });
    } catch (error: any) {
      const msg = error?.message || 'Cashout execution failed';
      const status = msg.includes('Insufficient') ? 400 : 500;
      res.status(status).json({ success: false, error: msg });
    }
  }

  /**
   * POST /api/v1/wallet/topup
   */
  static topup(_req: AuthenticatedRequest, res: Response): void {
    res.status(400).json({
      success: false,
      error: 'Wallet credits are recorded only after a confirmed provider payment. This route does not mint a balance.',
    });
  }

  /**
   * GET /api/v1/wallet/transactions
   */
  static async getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      res.json({ success: true, transactions: await walletService.getTransactions(req.user!.id) });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch transactions' });
    }
  }

  /**
   * GET /api/v1/wallet/ledger-transactions
   */
  static async getLedgerTransactions(req: Request, res: Response): Promise<void> {
    try {
      const address = String(req.query.address || '').trim();
      const explicitChain = String(req.query.chain || '').toLowerCase();
      const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), 50);

      if (!address) {
        res.status(400).json({ success: false, error: 'address query parameter is required' });
        return;
      }

      const isStellar = explicitChain === 'stellar' || address.startsWith('G');
      const isXrpl = explicitChain === 'xrpl' || address.startsWith('r');

      if (isXrpl) {
        const client = new Client(env.XRPL_WSS || env.XRPL_TESTNET_WSS || XRPL_TESTNET.wss);
        await client.connect();

        let xrplTxs: any[] = [];
        try {
          const txRes = await client.request({
            command: 'account_tx',
            account: address,
            limit,
          });
          xrplTxs = txRes.result.transactions || [];
        } catch (xrplErr: any) {
          if (xrplErr?.data?.error === 'actNotFound') {
            res.json({ success: true, chain: 'XRPL', address, transactions: [] });
            return;
          }
          throw xrplErr;
        } finally {
          await client.disconnect();
        }

        const formatted = xrplTxs.map((item: any) => {
          const tx = item.tx_json || item.tx || {};
          const meta = item.meta || item.metaData || {};
          const isSuccess = meta?.TransactionResult === 'tesSUCCESS';
          const isIncoming = tx.Destination === address;

          let amountStr = '0 XRP';
          if (tx.Amount) {
            if (typeof tx.Amount === 'string') {
              amountStr = `${Number(dropsToXrp(tx.Amount)).toFixed(4)} XRP`;
            } else if (typeof tx.Amount === 'object') {
              amountStr = `${tx.Amount.value} ${tx.Amount.currency}`;
            }
          } else if (meta?.delivered_amount) {
            if (typeof meta.delivered_amount === 'string') {
              amountStr = `${Number(dropsToXrp(meta.delivered_amount)).toFixed(4)} XRP`;
            } else if (typeof meta.delivered_amount === 'object') {
              amountStr = `${meta.delivered_amount.value} ${meta.delivered_amount.currency}`;
            }
          }

          const closeTime =
            item.close_time_iso ||
            (tx.date ? new Date((tx.date + 946684800) * 1000).toISOString() : new Date().toISOString());

          return {
            id: item.hash,
            txHash: item.hash,
            chain: 'XRPL',
            type: tx.TransactionType || 'Payment',
            sender: tx.Account || '',
            destination: tx.Destination || '',
            isIncoming,
            amount: amountStr,
            status: isSuccess ? 'CONFIRMED' : 'FAILED',
            ledgerSeq: item.ledger_index || tx.ledger_index || 0,
            timestamp: closeTime,
            explorerUrl: `${XRPL_TESTNET.explorerTxBase}${item.hash}`,
          };
        });

        res.json({ success: true, chain: 'XRPL', address, transactions: formatted });
        return;
      }

      if (isStellar) {
        const server = new Horizon.Server(
          env.HORIZON_URL || env.STELLAR_HORIZON_TESTNET_URL || STELLAR_TESTNET.horizonUrl
        );

        let payments: any;
        try {
          payments = await server.payments().forAccount(address).order('desc').limit(limit).call();
        } catch (stErr: any) {
          if (stErr?.response?.status === 404 || stErr?.status === 404) {
            res.json({ success: true, chain: 'STELLAR', address, transactions: [] });
            return;
          }
          throw stErr;
        }

        const formatted = (payments.records || []).map((p: any) => {
          const isIncoming = p.to === address;
          let amountStr = '0 XLM';
          if (p.amount) {
            amountStr = `${p.amount} ${p.asset_code || 'XLM'}`;
          } else if (p.starting_balance) {
            amountStr = `${p.starting_balance} XLM`;
          }

          return {
            id: p.id || p.transaction_hash,
            txHash: p.transaction_hash,
            chain: 'STELLAR',
            type: p.type === 'payment' ? 'Payment' : p.type === 'create_account' ? 'Create Account' : p.type || 'Operation',
            sender: p.from || p.funder || '',
            destination: p.to || p.account || address,
            isIncoming,
            amount: amountStr,
            status: 'CONFIRMED',
            ledgerSeq: p.transaction_successful ? 1 : 0,
            timestamp: p.created_at || new Date().toISOString(),
            explorerUrl: `${STELLAR_TESTNET.explorerTxBase}${p.transaction_hash}`,
          };
        });

        res.json({ success: true, chain: 'STELLAR', address, transactions: formatted });
        return;
      }

      res.status(400).json({ success: false, error: 'Address must be a valid Stellar (G...) or XRPL (r...) address' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to query on-chain transactions' });
    }
  }
}
