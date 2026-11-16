import type {
  ChainActionLogDTO,
  DualRailTokenSummaryDTO,
  PlatformAUCResponse,
  PlatformConfigDTO,
  SmartContractDTO,
  TreasurySummaryResponse,
} from '@/types';
import type { ExchangeRatesData } from '@/lib/rates';

/* ==========================================================================
   Shared types, formatting, and model contract for the operator console.
   ========================================================================== */

export type AdminTab =
  | 'overview'
  | 'treasury'
  | 'orders'
  | 'ledger'
  | 'amm'
  | 'vaults'
  | 'catalog'
  | 'rates'
  | 'agent'
  | 'audit';

export const ADMIN_TABS: AdminTab[] = [
  'overview',
  'treasury',
  'orders',
  'ledger',
  'amm',
  'vaults',
  'catalog',
  'rates',
  'agent',
  'audit',
];

export interface LiveOrder {
  id: string;
  orderNumber: string;
  buyerEmail: string;
  rail: string;
  amount: string;
  status: string;
  txHash: string;
  explorerUrl: string;
  createdAt: string;
}

export interface NrPoolStatus {
  priceUsd: number;
  change24hPercent: number;
  reserveUsd: number;
  poolNrSupply: number;
  circulatingNr: number;
  marketCapUsd: number;
  cumulativeFeeInjectedUsd: number;
  invariantK: string;
}

export interface StellarRpcHealth {
  status?: string;
  protocolVersion?: number;
  latestLedger?: number;
  latencyMs?: number;
  rpcUrl?: string;
}

export type FeedbackTone = 'success' | 'error' | 'info';

export interface AdminModel {
  /* Navigation */
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  lastSyncedAt: Date | null;

  /* Orders */
  liveOrders: LiveOrder[];
  ordersSearch: string;
  setOrdersSearch: (value: string) => void;
  ordersPage: number;
  setOrdersPage: (page: number) => void;
  ordersStatusFilter: string;
  setOrdersStatusFilter: (value: string) => void;
  filteredOrders: LiveOrder[];
  paginatedOrders: LiveOrder[];
  ORDERS_PER_PAGE: number;

  /* AMM / protocol token */
  nrPoolStatus: NrPoolStatus | null;
  reserveDeltaUsd: string;
  setReserveDeltaUsd: (value: string) => void;
  reserveNote: string;
  setReserveNote: (value: string) => void;
  adjustingReserve: boolean;
  reserveFeedback: string;
  reserveFeedbackTone: FeedbackTone;
  handleAdjustReserve: (deltaUsd: number) => void;

  /* Catalog */
  adminProducts: any[];
  catalogLoading: boolean;
  catalogSearch: string;
  setCatalogSearch: (value: string) => void;
  catalogPage: number;
  setCatalogPage: (page: number) => void;
  catalogCategory: string;
  setCatalogCategory: (value: string) => void;
  filteredCatalog: any[];
  paginatedCatalog: any[];
  CATALOG_PER_PAGE: number;
  loadAdminProducts: () => void;

  /* Custody ledger */
  aucData: PlatformAUCResponse | null;
  aucLoading: boolean;
  loadPlatformAUC: () => void;

  /* Treasury */
  treasurySummary: TreasurySummaryResponse | null;
  treasuryConfig: PlatformConfigDTO | null;
  treasuryEntries: any[];
  treasuryLoading: boolean;
  treasuryEntriesPage: number;
  setTreasuryEntriesPage: (page: number) => void;
  treasurySearch: string;
  setTreasurySearch: (value: string) => void;
  filteredTreasuryEntries: any[];
  paginatedTreasuryEntries: any[];
  TREASURY_PER_PAGE: number;
  loadTreasuryData: () => void;
  orderFeeBpsInput: number;
  setOrderFeeBpsInput: (value: number) => void;
  swapSpreadBpsInput: number;
  setSwapSpreadBpsInput: (value: number) => void;
  cashoutSpreadBpsInput: number;
  setCashoutSpreadBpsInput: (value: number) => void;
  buybackSharePctInput: number;
  setBuybackSharePctInput: (value: number) => void;
  isPausedInput: boolean;
  setIsPausedInput: (value: boolean) => void;
  savingConfig: boolean;
  configFeedback: string;
  configFeedbackTone: FeedbackTone;
  handleSaveConfig: () => void;
  triggeringSplit: boolean;
  splitFeedback: string;
  splitFeedbackTone: FeedbackTone;
  handleTriggerProfitSplit: () => void;

  /* Contracts & dual rail */
  smartContract: SmartContractDTO | null;
  rpcHealth: StellarRpcHealth | null;
  dualRailSummary: DualRailTokenSummaryDTO | null;
  dualRailLoading: boolean;
  dualRailFeedback: string;
  dualRailFeedbackTone: FeedbackTone;
  loadDualRailStatus: () => void;
  ammDepositXrp: string;
  setAmmDepositXrp: (value: string) => void;
  ammDepositNr: string;
  setAmmDepositNr: (value: string) => void;
  ammDepositing: boolean;
  handleDepositAmm: () => void;

  /* Audit */
  chainLogs: ChainActionLogDTO[];
  chainLogsLoading: boolean;
  auditPage: number;
  setAuditPage: (page: number) => void;
  auditSearch: string;
  setAuditSearch: (value: string) => void;
  filteredAuditLogs: ChainActionLogDTO[];
  paginatedAuditLogs: ChainActionLogDTO[];
  AUDIT_PER_PAGE: number;
  loadChainLogs: () => void;

  /* Rates */
  rates: ExchangeRatesData | null;
  ratesLoading: boolean;
  refreshRates: () => void;

  /* Credentials */
  openCredentials: () => void;

  /* Utilities */
  refreshAll: () => void;
}

/* -------------------------------- Formatters ------------------------------- */

export function formatUsd(value: number | null | undefined, digits = 2) {
  const safe = Number.isFinite(value as number) ? (value as number) : 0;
  return `$${safe.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatMoney(cents: number | null | undefined, digits = 2) {
  return formatUsd((Number(cents) || 0) / 100, digits);
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  const safe = Number.isFinite(value as number) ? (value as number) : 0;
  return safe.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function formatTime(value?: string | Date | null) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatQuantity(value: number | null | undefined, symbol: string) {
  const safe = Number.isFinite(value as number) ? (value as number) : 0;
  const isWeight = symbol.includes('GOLD') || symbol.includes('SILVER');
  return `${safe.toLocaleString('en-US', {
    minimumFractionDigits: isWeight ? 2 : 0,
    maximumFractionDigits: isWeight ? 2 : 2,
  })}${isWeight ? ' g' : ''}`;
}

export function initialsFor(value?: string | null) {
  const source = (value || 'NR').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] || 'N').concat(parts[1]?.[0] || parts[0]?.[1] || 'R').toUpperCase();
}

export function truncateMiddle(value?: string | null, head = 8, tail = 6) {
  if (!value) return '—';
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function maskSecret(value?: string | null) {
  if (!value) return '—';
  if (value.length <= 12) return '••••••••••••';
  return `${value.slice(0, 4)}••••••••••••${value.slice(-4)}`;
}
