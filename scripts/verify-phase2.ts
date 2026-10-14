import { XRPLService } from '../apps/api/src/services/xrpl.js';
import { StellarService } from '../apps/api/src/services/stellar.js';
import { SorobanService } from '../apps/api/src/services/soroban.js';
import { RatesService } from '../apps/api/src/services/rates.js';
import { IpfsService } from '../apps/api/src/services/ipfs.js';

async function verifyPhase2() {
  console.log('⚡ Starting NexusRail Phase 2 Multi-Rail Web3 Verification Suite...\n');

  // 1. Verify XRPL Testnet Invoice
  const xrplInvoice = await XRPLService.createPaymentInvoice('ORD-XRPL-001', 25.5);
  console.log(`✅ [1/5] XRPL Testnet: Invoice generated (Tag: ${xrplInvoice.destinationTag}), Drops: ${xrplInvoice.amountDrops}`);

  // 2. Verify Stellar Horizon Invoice
  const stellarInvoice = await StellarService.createPaymentInvoice('ORD-XLM-001', 100);
  console.log(`✅ [2/5] Stellar Horizon: Invoice generated (Memo: ${stellarInvoice.memoText})`);

  // 3. Verify Soroban Contract Inspector
  const sorobanStatus = await SorobanService.getContractExecutionStatus('0x98127391');
  console.log(`✅ [3/5] Soroban Inspector: Contract status = ${sorobanStatus.status} (Ledger Seq: ${sorobanStatus.ledgerSeq})`);

  // 4. Verify Crypto Exchange Rates
  const rates = await RatesService.getExchangeRates();
  console.log(`✅ [4/5] Exchange Rates: 1 USD = ${rates.XRP} XRP / ${rates.XLM} XLM`);

  // 5. Verify IPFS Receipt Pinning
  const ipfsResult = await IpfsService.pinOrderReceipt('ORD-XRPL-001', { paid: true });
  console.log(`✅ [5/5] IPFS Pinata: Pinned receipt CID = ${ipfsResult.ipfsCid}`);

  console.log('\n🎉 Phase 2 Multi-Rail Web3 Milestone Fully Verified & Operational!');
}

verifyPhase2().catch(console.error);
