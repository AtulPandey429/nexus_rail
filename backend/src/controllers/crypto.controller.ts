import { Request, Response } from 'express';
import crypto from 'crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { isValidClassicAddress } from 'xrpl';
import { RatesService } from '../services/rates.js';
import { chainRegistry } from '../services/crypto/index.js';
import { verifyToken } from '../services/jwt.js';
import { walletService } from '../services/wallet.js';
import { DualRailTokenService } from '../services/dualRailToken.service.js';
import { SupplyReconciliationService } from '../services/supplyReconciliation.service.js';
import { MongoService, MongoTokenWithdrawalDoc } from '../services/mongo.js';
import { RedisCacheService } from '../services/redis.js';

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
    const targetChain: 'XRPL' | 'STELLAR' = isXrpl ? 'XRPL' : 'STELLAR';

    if (isXrpl && !isValidClassicAddress(targetAddress)) {
      return res.status(400).json({
        success: false,
        error: `Invalid XRPL destination address "${targetAddress}". Expected a valid classic address starting with "r".`,
      });
    }
    if (!isXrpl && !StrKey.isValidEd25519PublicKey(targetAddress)) {
      return res.status(400).json({
        success: false,
        error: `Invalid Stellar destination address "${targetAddress}". Expected a valid 56-character Ed25519 public key starting with "G".`,
      });
    }

    const requestedMicro = Math.round(numAmount * 1_000_000);
    const withdrawalId = `wd_${crypto.randomUUID().slice(0, 16)}`;

    try {
      // 1. Pre-flight verification: Destination Trustline + On-Chain Protocol Reserve Availability (D2 Option A)
      let verifiedIssuer: string | undefined;
      if (isXrpl) {
        const tl = await DualRailTokenService.checkXrplTrustline(targetAddress, 'NXL');
        if (!tl.hasTrustline) {
          return res.status(400).json({
            success: false,
            trustlineRequired: true,
            issuer: tl.issuer,
            currency: 'NXL',
            error: `XRPL Trustline Missing: Account "${targetAddress}" has not established an active Trustline to Issuer "${tl.issuer}" for currency "NXL".`,
          });
        }
        verifiedIssuer = tl.issuer;
      } else {
        const tl = await DualRailTokenService.checkStellarTrustline(targetAddress, 'NXL');
        if (!tl.hasTrustline) {
          return res.status(400).json({
            success: false,
            trustlineRequired: true,
            issuer: tl.issuer,
            assetCode: 'NXL',
            error: `Stellar Trustline Missing: Account "${targetAddress}" has not established an active Trustline to Issuer "${tl.issuer}" for asset "NXL".`,
          });
        }
        verifiedIssuer = tl.issuer;
      }

      await SupplyReconciliationService.verifyReserveForWithdrawal(targetChain, numAmount);

      // 2. Atomic Debit FIRST (CRIT-02 TOCTOU Overdraft & Double-Spend Defense)
      await walletService.applyEntry(userId, requestedMicro, 'DEBIT', 'NXL', withdrawalId);

      // 3. Broadcast REAL On-Chain Token Transfer (CRIT-01 Fix: No fake stub hashes)
      let txHash: string;
      let ledgerSeq: number | undefined;
      let explorerUrl: string;

      try {
        if (isXrpl) {
          const xrplRes = await DualRailTokenService.withdrawNrToXrplAddress(
            userId,
            numAmount,
            targetAddress,
            { skipTrustlineCheck: true, verifiedIssuer }
          );
          txHash = xrplRes.txHash;
          ledgerSeq = xrplRes.ledgerSeq;
          explorerUrl = xrplRes.explorerUrl;
        } else {
          const stellarRes = await DualRailTokenService.withdrawNrToStellarAddress(
            userId,
            numAmount,
            targetAddress,
            { skipTrustlineCheck: true, verifiedIssuer }
          );
          txHash = stellarRes.txHash;
          ledgerSeq = stellarRes.ledgerSeq;
          explorerUrl = stellarRes.explorerUrl;
        }
      } catch (broadcastErr: any) {
        // Atomic Rollback: Refund user's internal $NXL balance if on-chain broadcast failed
        await walletService
          .applyEntry(userId, requestedMicro, 'CREDIT', 'NXL', `refund:${withdrawalId}`)
          .catch((refundErr) => {
            console.error(`🚨 [CryptoController] Critical withdrawal refund failure for ${withdrawalId}:`, refundErr);
          });

        try {
          const withdrawalsCol = await MongoService.getCollection<MongoTokenWithdrawalDoc>('token_withdrawals');
          await withdrawalsCol.insertOne({
            id: withdrawalId,
            user_id: userId,
            amount_nr: numAmount,
            destination_address: targetAddress,
            chain: targetChain,
            destination_stellar_address: isXrpl ? undefined : targetAddress,
            tx_hash: '',
            status: 'FAILED',
            error_message: broadcastErr?.message || 'On-chain broadcast failed',
            created_at: new Date().toISOString(),
          });
        } catch {}

        throw broadcastErr;
      }

      // 4. Persist confirmed on-chain withdrawal record
      try {
        const withdrawalsCol = await MongoService.getCollection<MongoTokenWithdrawalDoc>('token_withdrawals');
        await withdrawalsCol.insertOne({
          id: withdrawalId,
          user_id: userId,
          amount_nr: numAmount,
          destination_address: targetAddress,
          chain: targetChain,
          destination_stellar_address: isXrpl ? undefined : targetAddress,
          tx_hash: txHash,
          ledger_seq: ledgerSeq,
          status: 'CONFIRMED',
          created_at: new Date().toISOString(),
        });
      } catch {}

      await Promise.all([
        RedisCacheService.invalidateCache('admin:dual-rail:summary').catch(() => {}),
        RedisCacheService.invalidateCache('admin:tokenomics:reconciliation').catch(() => {}),
      ]);
      const updatedBalances = await walletService.getBalance(userId);

      res.json({
        success: true,
        data: {
          withdrawalId,
          amountNxl: numAmount,
          amountNr: numAmount,
          chain: targetChain,
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
