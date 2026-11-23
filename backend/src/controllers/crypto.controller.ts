import { Request, Response } from 'express';
import crypto from 'crypto';
import { RatesService } from '../services/rates.js';
import { chainRegistry } from '../services/crypto/index.js';
import { verifyToken } from '../services/jwt.js';
import { walletService } from '../services/wallet.js';
import { StellarTokenIssuerService } from '../scripts/deployStellarNrToken.js';
import { DualRailTokenService } from '../services/dualRailToken.service.js';
import { RedisCacheService } from '../services/redis.js';
import { STELLAR_TESTNET } from '../utils/constants.js';

export class CryptoController {
  /**
   * GET /api/v1/crypto/rates
   * Live exchange rates for USD, XRP, XLM
   */
  static async getRates(_req: Request, res: Response) {
    try {
      const rates = await RatesService.getExchangeRates();
      res.json({ success: true, data: rates });
    } catch (error) {
      res.status(502).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch exchange rates',
      });
    }
  }

  /**
   * GET /api/v1/crypto/providers
   * Discover registered multi-chain providers
   */
  static async getProviders(_req: Request, res: Response) {
    try {
      const providers = chainRegistry.getAllProviders();
      const list = await Promise.all(
        providers.map(async (p) => {
          let balanceInfo = { balance: 0, currency: p.assetSymbol };
          try {
            balanceInfo = await p.getAccountBalance();
          } catch {
            // Continue if node temporarily unreachable
          }
          return {
            chainId: p.chainId,
            assetSymbol: p.assetSymbol,
            network: p.network,
            vaultBalance: balanceInfo.balance,
            isTestnet: p.network === 'testnet',
          };
        })
      );
      res.json({ success: true, data: list });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/crypto/balance/:chain
   * Live testnet / mainnet account balance
   */
  static async getBalance(req: Request, res: Response) {
    try {
      const chainId = String(req.params.chain || '');
      const address = req.query.address ? String(req.query.address) : undefined;
      const provider = chainRegistry.getRequiredProvider(chainId);
      const balance = await provider.getAccountBalance(address);
      res.json({
        success: true,
        chain: provider.chainId,
        network: provider.network,
        data: balance,
      });
    } catch (error: any) {
      res.status(502).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/crypto/verify/:chain/:txHash
   * Direct transaction verification
   */
  static async verifyTransaction(req: Request, res: Response) {
    try {
      const chainId = String(req.params.chain || '');
      const txHash = String(req.params.txHash || '');
      const provider = chainRegistry.getRequiredProvider(chainId);
      const result = await provider.verifyPayment('manual_verify', txHash);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(502).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/crypto/nr/withdraw or /nxl/withdraw
   * User 1-Click On-Chain Token Withdrawal ($NXL)
   */
  static async withdrawToken(req: Request, res: Response) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Sign in is required to withdraw $NXL on-chain' });
    }

    let userId: string;
    try {
      const payload = verifyToken(authHeader.slice('Bearer '.length).trim());
      userId = payload.id;
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired authentication token' });
    }

    const { amount, destinationAddress, destinationStellarAddress, chain } = req.body || {};
    const targetAddress = (destinationAddress || destinationStellarAddress || '').trim();
    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid positive amount of $NXL is required' });
    }
    if (!targetAddress) {
      return res.status(400).json({ success: false, error: 'Destination wallet address is required' });
    }

    const isXrpl = chain === 'XRPL' || targetAddress.startsWith('r');

    try {
      const balances = await walletService.getBalance(userId);
      const availableNxlMicro = balances.NXL || 0;
      const requestedMicro = Math.round(numAmount * 1_000_000);

      if (availableNxlMicro < requestedMicro) {
        return res.status(400).json({
          success: false,
          error: `Insufficient $NXL balance. You have ${(availableNxlMicro / 1_000_000).toFixed(6)} $NXL available.`,
        });
      }

      let txHash: string;
      let ledgerSeq: number | undefined;
      let explorerUrl: string;
      let withdrawalId = `wd_${crypto.randomUUID().slice(0, 16)}`;

      if (isXrpl) {
        const xrplRes = await DualRailTokenService.withdrawNrToXrplAddress(userId, numAmount, targetAddress);
        txHash = xrplRes.txHash;
        ledgerSeq = xrplRes.ledgerSeq;
        explorerUrl = xrplRes.explorerUrl;
      } else {
        const withdrawal = await StellarTokenIssuerService.withdrawNrToExternalAddress(
          userId,
          numAmount,
          targetAddress
        );
        txHash = withdrawal.tx_hash;
        ledgerSeq = withdrawal.ledger_seq;
        explorerUrl = `${STELLAR_TESTNET.explorerTxBase}${withdrawal.tx_hash}`;
        withdrawalId = withdrawal.id;
      }

      await walletService.applyEntry(userId, requestedMicro, 'DEBIT', 'NXL', withdrawalId);
      await RedisCacheService.invalidateCache('admin:dual-rail:summary');
      const updatedBalances = await walletService.getBalance(userId);

      res.json({
        success: true,
        data: {
          withdrawalId,
          amountNxl: numAmount,
          amountNr: numAmount,
          chain: isXrpl ? 'XRPL' : 'STELLAR',
          destinationAddress: targetAddress,
          destinationStellarAddress: targetAddress,
          txHash,
          ledgerSeq,
          remainingBalance: Number(((updatedBalances.NXL || 0) / 1_000_000).toFixed(6)),
          remainingNrBalance: Number(((updatedBalances.NXL || 0) / 1_000_000).toFixed(6)),
          explorerUrl,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'On-chain withdrawal failed' });
    }
  }
}
