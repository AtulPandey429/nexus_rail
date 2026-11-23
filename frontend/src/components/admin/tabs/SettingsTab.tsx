'use client';

import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Globe,
  Percent,
  Layers,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Key,
  ShieldCheck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Feedback,
  Field,
  SectionHeader,
  StatCard,
  inputClassName,
} from '@/components/admin/AdminUI';
import { readSession } from '@/lib/shop';

export interface PlatformSettingsState {
  network_mode: 'testnet' | 'mainnet';
  fees: {
    swap_fee_bps: number;
    platform_order_fee_bps: number;
    cashback_rate_bps: number;
    slippage_tolerance_bps: number;
    cashout_spread_bps: number;
    nxl_discount_bps: number;
  };
  stellar: {
    networkPassphrase: string;
    horizonUrl: string;
    rpcUrl: string;
    merchantVault: string;
    distributorVault: string;
    nxlAssetCode: string;
    nxlIssuerPublic: string;
    nxlContractId: string;
    nexusVaultContractId: string;
    nexusSwapContractId: string;
    xlmSacContractId: string;
    explorerBase: string;
    explorerTxBase: string;
  };
  xrpl: {
    wss: string;
    merchantVault: string;
    distributorVault: string;
    nxlCurrencyCode: string;
    nxlCurrencyHex: string;
    nxlIssuerAddress: string;
    nxlAmmAccount: string;
    explorerBase: string;
    explorerTxBase: string;
  };
  updated_at?: string;
  updated_by?: string;
}

export function SettingsTab() {
  const [settings, setSettings] = useState<PlatformSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Encrypted Secrets State
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [secretsLoading, setSecretsLoading] = useState(false);
  const [secretsSaving, setSecretsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [secretsFeedback, setSecretsFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const session = readSession();
      const res = await fetch('/api/v1/admin/platform/settings', {
        headers: {
          Authorization: session?.token ? `Bearer ${session.token}` : '',
        },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
      } else {
        setFeedback({ tone: 'error', message: json.error || 'Failed to fetch platform settings' });
      }
    } catch (err: any) {
      setFeedback({ tone: 'error', message: err.message || 'Network error fetching settings' });
    } finally {
      setLoading(false);
    }
  };

  const loadSecrets = async () => {
    setSecretsLoading(true);
    setSecretsFeedback(null);
    try {
      const session = readSession();
      const res = await fetch('/api/v1/admin/platform/secrets', {
        headers: {
          Authorization: session?.token ? `Bearer ${session.token}` : '',
        },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSecrets(json.data);
      } else {
        setSecretsFeedback({ tone: 'error', message: json.error || 'Failed to fetch encrypted secrets' });
      }
    } catch (err: any) {
      setSecretsFeedback({ tone: 'error', message: err.message || 'Error fetching secrets' });
    } finally {
      setSecretsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
    void loadSecrets();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setFeedback(null);
    try {
      const session = readSession();
      const res = await fetch('/api/v1/admin/platform/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: session?.token ? `Bearer ${session.token}` : '',
        },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        setSettings(json.data);
        setFeedback({
          tone: 'success',
          message: 'Platform settings saved to database and live public config successfully updated!',
        });
      } else {
        setFeedback({ tone: 'error', message: json.error || 'Failed to update platform settings' });
      }
    } catch (err: any) {
      setFeedback({ tone: 'error', message: err.message || 'Error saving settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecrets = async () => {
    setSecretsSaving(true);
    setSecretsFeedback(null);
    try {
      const session = readSession();
      const res = await fetch('/api/v1/admin/platform/secrets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: session?.token ? `Bearer ${session.token}` : '',
        },
        body: JSON.stringify(secrets),
      });
      const json = await res.json();
      if (json.success) {
        setSecrets(json.data);
        setSecretsFeedback({
          tone: 'success',
          message: 'Secrets encrypted with AES-256-GCM and saved to MongoDB Atlas securely!',
        });
      } else {
        setSecretsFeedback({ tone: 'error', message: json.error || 'Failed to update encrypted secrets' });
      }
    } catch (err: any) {
      setSecretsFeedback({ tone: 'error', message: err.message || 'Error saving secrets' });
    } finally {
      setSecretsSaving(false);
    }
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-admin-gold" />
        <p className="text-xs text-admin-muted">Loading dynamic platform settings from database…</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <Card className="p-6">
        <Feedback tone="error">{feedback?.message || 'Could not load platform settings'}</Feedback>
        <Button variant="secondary" className="mt-4" onClick={loadSettings}>
          Retry
        </Button>
      </Card>
    );
  }

  const isTestnet = settings.network_mode === 'testnet';

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && <Feedback tone={feedback.tone}>{feedback.message}</Feedback>}

      {/* Network Environment Selector */}
      <Card className="p-6">
        <SectionHeader
          title="Active Blockchain Network Environment"
          description="Switching between Testnet and Mainnet updates public API config, settlement rails, and explorer links across the platform."
          action={
            <Badge tone={isTestnet ? 'warning' : 'success'}>
              {settings.network_mode.toUpperCase()} ACTIVE
            </Badge>
          }
        />

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            onClick={() => setSettings({ ...settings, network_mode: 'testnet' })}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              isTestnet
                ? 'border-amber-400/50 bg-amber-400/[0.08] shadow-sm'
                : 'border-white/[0.08] bg-black/20 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Globe className={`h-5 w-5 ${isTestnet ? 'text-amber-400' : 'text-admin-faint'}`} />
                <span className="text-sm font-semibold text-white">Testnet Environment</span>
              </div>
              {isTestnet && <CheckCircle2 className="h-4 w-4 text-amber-400" />}
            </div>
            <p className="mt-2 text-xs text-admin-muted">
              Stellar Testnet & XRPL Testnet. Free testing faucets, sandbox contracts, safe simulated settlements.
            </p>
          </div>

          <div
            onClick={() => setSettings({ ...settings, network_mode: 'mainnet' })}
            className={`cursor-pointer rounded-xl border p-4 transition-all ${
              !isTestnet
                ? 'border-emerald-400/50 bg-emerald-400/[0.08] shadow-sm'
                : 'border-white/[0.08] bg-black/20 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Globe className={`h-5 w-5 ${!isTestnet ? 'text-emerald-400' : 'text-admin-faint'}`} />
                <span className="text-sm font-semibold text-white">Mainnet Environment</span>
              </div>
              {!isTestnet && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            </div>
            <p className="mt-2 text-xs text-admin-muted">
              Public Stellar Network & XRPL Production Cluster. Real capital settlements and live Soroban contracts.
            </p>
          </div>
        </div>
      </Card>

      {/* Dynamic Platform Fees & Spreads */}
      <Card className="p-6">
        <SectionHeader
          title="Dynamic Fee Structures & Rewards"
          description="Set platform fee percentages, cashback awards, slippage limits, and $NXL discount tiers in Basis Points (100 BPS = 1.00%)."
        />

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Swap Spread (BPS)"
            hint={`${((settings.fees.swap_fee_bps || 0) / 100).toFixed(2)}% fee applied to cross-chain swaps`}
          >
            <input
              type="number"
              className={inputClassName}
              value={settings.fees.swap_fee_bps}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fees: { ...settings.fees, swap_fee_bps: Number(e.target.value) || 0 },
                })
              }
            />
          </Field>

          <Field
            label="Platform Order Fee (BPS)"
            hint={`${((settings.fees.platform_order_fee_bps || 0) / 100).toFixed(2)}% fee on retail store checkouts`}
          >
            <input
              type="number"
              className={inputClassName}
              value={settings.fees.platform_order_fee_bps}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fees: { ...settings.fees, platform_order_fee_bps: Number(e.target.value) || 0 },
                })
              }
            />
          </Field>

          <Field
            label="Cashback Reward Rate (BPS)"
            hint={`${((settings.fees.cashback_rate_bps || 0) / 100).toFixed(2)}% awarded in $NXL tokens upon order delivery`}
          >
            <input
              type="number"
              className={inputClassName}
              value={settings.fees.cashback_rate_bps}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fees: { ...settings.fees, cashback_rate_bps: Number(e.target.value) || 0 },
                })
              }
            />
          </Field>

          <Field
            label="Slippage Tolerance (BPS)"
            hint={`Maximum adverse price movement (${((settings.fees.slippage_tolerance_bps || 0) / 100).toFixed(2)}%) before quote quarantine`}
          >
            <input
              type="number"
              className={inputClassName}
              value={settings.fees.slippage_tolerance_bps}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fees: { ...settings.fees, slippage_tolerance_bps: Number(e.target.value) || 0 },
                })
              }
            />
          </Field>

          <Field
            label="Cashout Spread (BPS)"
            hint={`Spread (${((settings.fees.cashout_spread_bps || 0) / 100).toFixed(2)}%) applied when users cash out portfolio assets`}
          >
            <input
              type="number"
              className={inputClassName}
              value={settings.fees.cashout_spread_bps}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fees: { ...settings.fees, cashout_spread_bps: Number(e.target.value) || 0 },
                })
              }
            />
          </Field>

          <Field
            label="$NXL Checkout Discount (BPS)"
            hint={`Discount (${((settings.fees.nxl_discount_bps || 0) / 100).toFixed(2)}%) granted for settling orders with $NXL tokens`}
          >
            <input
              type="number"
              className={inputClassName}
              value={settings.fees.nxl_discount_bps}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fees: { ...settings.fees, nxl_discount_bps: Number(e.target.value) || 0 },
                })
              }
            />
          </Field>
        </div>
      </Card>

      {/* Stellar Network Endpoints & Contracts */}
      <Card className="p-6">
        <SectionHeader
          title="Stellar Soroban Rail Configuration"
          description="Manage Horizon API URL, Soroban RPC URL, Network Passphrase, and live Soroban contract IDs."
        />

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Horizon URL">
            <input
              type="text"
              className={inputClassName}
              value={settings.stellar.horizonUrl}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  stellar: { ...settings.stellar, horizonUrl: e.target.value },
                })
              }
            />
          </Field>

          <Field label="Soroban RPC URL">
            <input
              type="text"
              className={inputClassName}
              value={settings.stellar.rpcUrl}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  stellar: { ...settings.stellar, rpcUrl: e.target.value },
                })
              }
            />
          </Field>

          <Field label="Network Passphrase">
            <input
              type="text"
              className={inputClassName}
              value={settings.stellar.networkPassphrase}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  stellar: { ...settings.stellar, networkPassphrase: e.target.value },
                })
              }
            />
          </Field>

          <Field label="Merchant Vault Public Key">
            <input
              type="text"
              className={inputClassName}
              value={settings.stellar.merchantVault}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  stellar: { ...settings.stellar, merchantVault: e.target.value },
                })
              }
            />
          </Field>

          <Field label="Nexus Vault Contract ID (Soroban)">
            <input
              type="text"
              className={inputClassName}
              value={settings.stellar.nexusVaultContractId}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  stellar: { ...settings.stellar, nexusVaultContractId: e.target.value },
                })
              }
            />
          </Field>

          <Field label="NXL Token Contract ID (SAC)">
            <input
              type="text"
              className={inputClassName}
              value={settings.stellar.nxlContractId}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  stellar: { ...settings.stellar, nxlContractId: e.target.value },
                })
              }
            />
          </Field>
        </div>
      </Card>

      {/* XRPL Network Endpoints & AMM */}
      <Card className="p-6">
        <SectionHeader
          title="XRP Ledger Rail Configuration"
          description="Manage XRPL WebSocket server URL, NXL Issuer Address, and XLS-30d AMM Account."
        />

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="XRPL WebSocket URL (WSS)">
            <input
              type="text"
              className={inputClassName}
              value={settings.xrpl.wss}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  xrpl: { ...settings.xrpl, wss: e.target.value },
                })
              }
            />
          </Field>

          <Field label="Merchant Vault Address">
            <input
              type="text"
              className={inputClassName}
              value={settings.xrpl.merchantVault}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  xrpl: { ...settings.xrpl, merchantVault: e.target.value },
                })
              }
            />
          </Field>

          <Field label="NXL Issuer Account Address">
            <input
              type="text"
              className={inputClassName}
              value={settings.xrpl.nxlIssuerAddress}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  xrpl: { ...settings.xrpl, nxlIssuerAddress: e.target.value },
                })
              }
            />
          </Field>

          <Field label="NXL AMM Account (XLS-30d Pool)">
            <input
              type="text"
              className={inputClassName}
              value={settings.xrpl.nxlAmmAccount}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  xrpl: { ...settings.xrpl, nxlAmmAccount: e.target.value },
                })
              }
            />
          </Field>
        </div>
      </Card>

      {/* Save Settings Button */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#11141B] p-5">
        <div className="text-xs text-admin-muted">
          Last updated: {settings.updated_at ? new Date(settings.updated_at).toLocaleString() : 'Never'}
          {settings.updated_by ? ` by ${settings.updated_by}` : ''}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={RefreshCw} onClick={loadSettings} disabled={saving}>
            Discard & Reload
          </Button>
          <Button variant="primary" icon={Save} onClick={handleSave} loading={saving}>
            Save Platform Settings
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Encrypted Secrets Vault (AES-256-GCM in Database, Admin-Only)            */}
      {/* ========================================================================= */}
      <Card className="p-6">
        <SectionHeader
          title="Encrypted Secrets & Credentials Vault"
          description="Stored in MongoDB Atlas using authenticated AES-256-GCM encryption. Visible and editable exclusively by verified platform administrators."
          action={
            <Badge tone="success" className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              AES-256-GCM ENCRYPTED
            </Badge>
          }
        />

        {secretsFeedback && (
          <div className="mt-4">
            <Feedback tone={secretsFeedback.tone}>{secretsFeedback.message}</Feedback>
          </div>
        )}

        <div className="mt-5 space-y-4">
          {[
            { key: 'stellarHotWalletSecret', label: 'Stellar Merchant Hot Wallet Secret (S...)', hint: 'Signs on-chain Stellar Soroban transactions' },
            { key: 'stellarNxlIssuerSecret', label: 'Stellar $NXL Token Issuer Secret (S...)', hint: 'Mints $NXL tokens on Stellar SAC' },
            { key: 'xrplHotWalletSeed', label: 'XRPL Merchant Hot Wallet Seed (s...)', hint: 'Signs on-chain XRP transactions' },
            { key: 'xrplNxlIssuerSeed', label: 'XRPL $NXL Token Issuer Seed (s...)', hint: 'Issues $NXL currency and AMM on XRPL' },
            { key: 'stripeSecretKey', label: 'Stripe Secret Key (sk_...)', hint: 'Server-side fiat checkout session creation' },
            { key: 'stripeWebhookSecret', label: 'Stripe Webhook Signing Secret (whsec_...)', hint: 'Validates HMAC signature of incoming Stripe webhooks' },
            { key: 'groqApiKey', label: 'Groq AI Agent API Key (gsk_...)', hint: 'Powers Llama-3.3-70b autonomous commerce assistant' },
            { key: 'supabaseServiceRoleKey', label: 'Supabase Service Role Key', hint: 'Direct admin database access key' },
            { key: 'pinataJwt', label: 'Pinata IPFS JWT Token', hint: 'Pins tamper-evident order receipts to IPFS' },
            { key: 'coingeckoApiKey', label: 'CoinGecko Pro API Key (Optional)', hint: 'High-frequency live currency quote rates' },
          ].map((item) => (
            <Field key={item.key} label={item.label} hint={item.hint}>
              <div className="relative">
                <input
                  type={showSecrets[item.key] ? 'text' : 'password'}
                  className={`${inputClassName} pr-10 font-mono text-xs`}
                  placeholder="Enter secret to encrypt & store in database..."
                  value={secrets[item.key] || ''}
                  onChange={(e) => setSecrets({ ...secrets, [item.key]: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => toggleShowSecret(item.key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-faint hover:text-white"
                  title={showSecrets[item.key] ? 'Hide secret' : 'Reveal secret'}
                >
                  {showSecrets[item.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-5">
          <p className="text-xs text-admin-muted">
            All keys are encrypted at rest with an authentication tag. Unauthenticated requests are rejected.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" icon={RefreshCw} onClick={loadSecrets} disabled={secretsSaving || secretsLoading}>
              Reload
            </Button>
            <Button variant="primary" icon={Lock} onClick={handleSaveSecrets} loading={secretsSaving}>
              Save Encrypted Secrets
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
