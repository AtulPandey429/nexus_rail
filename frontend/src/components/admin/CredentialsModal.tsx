'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  CopyValue,
  Feedback,
  Modal,
  Skeleton,
} from '@/components/admin/AdminUI';
import { maskSecret, truncateMiddle } from '@/components/admin/adminModel';

type CredentialRecord = Record<string, unknown>;

export type CredentialsData = {
  stellar?: CredentialRecord;
  xrpl?: CredentialRecord;
} | null;

export function CredentialsModal({
  open,
  onClose,
  data,
  loading,
  error,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  data: CredentialsData;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    if (!open) setShowSecrets(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="On-chain vault credentials"
      description="Restricted operator material for both settlement rails."
      icon={KeyRound}
      size="xl"
      footer={
        <>
          <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={onRefresh}>
            Refresh credentials
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/90" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-amber-100/80">
          These values grant control over testnet issuer accounts and distribution vaults. Secrets are masked by
          default. Never expose them in screenshots, support tickets, or shared sessions.
        </p>
      </div>

      {error && (
        <div className="mt-3">
          <Feedback tone="error">{error}</Feedback>
        </div>
      )}

      {loading && !data ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, group) => (
            <div key={group} className="rounded-xl border border-admin-border bg-[#0A0E15] p-4">
              <Skeleton className="h-4 w-28" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((__, index) => (
                  <div key={index}>
                    <Skeleton className="h-2 w-20" />
                    <Skeleton className="mt-1.5 h-3 w-40" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-admin-muted">
              Secrets are hidden unless explicitly revealed for this session.
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={showSecrets ? EyeOff : Eye}
              onClick={() => setShowSecrets((value) => !value)}
            >
              {showSecrets ? 'Hide secrets' : 'Reveal secrets'}
            </Button>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <CredentialGroup
              title="Stellar rail"
              subtitle="Soroban contract & NXL issuer"
              tone="sky"
              badge="Stellar"
              fields={[
                { label: 'Asset code', value: data.stellar?.assetCode },
                { label: 'Issuer address', value: data.stellar?.issuerAddress },
                { label: 'Issuer secret key', value: data.stellar?.issuerSecretKey, secret: true },
                { label: 'Contract ID', value: data.stellar?.contractId },
                { label: 'Distributor vault', value: data.stellar?.distributorVault },
                { label: 'Distributor secret key', value: data.stellar?.distributorSecretKey, secret: true },
                { label: 'Total supply cap', value: data.stellar?.totalSupplyCap },
                { label: 'Mint transaction', value: data.stellar?.mintTxHash },
              ]}
              explorerUrl={typeof data.stellar?.explorerUrl === 'string' ? data.stellar.explorerUrl : undefined}
              showSecrets={showSecrets}
            />
            <CredentialGroup
              title="XRPL rail"
              subtitle="XLS-30d AMM & issued asset"
              tone="violet"
              badge="XRPL"
              fields={[
                { label: 'Currency code', value: data.xrpl?.currencyCode },
                { label: 'Issuer address', value: data.xrpl?.issuerAddress },
                { label: 'Issuer secret seed', value: data.xrpl?.issuerSecretSeed, secret: true },
                { label: 'AMM account', value: data.xrpl?.ammAccount },
                { label: 'Distributor vault', value: data.xrpl?.distributorVault },
                { label: 'Distributor secret seed', value: data.xrpl?.distributorSecretSeed, secret: true },
                { label: 'Total supply cap', value: data.xrpl?.totalSupplyCap },
                { label: 'AMM transaction', value: data.xrpl?.ammTxHash },
              ]}
              explorerUrl={typeof data.xrpl?.explorerUrl === 'string' ? data.xrpl.explorerUrl : undefined}
              showSecrets={showSecrets}
            />
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-admin-border px-4 py-10 text-center">
          <KeyRound className="mx-auto h-5 w-5 text-admin-faint" aria-hidden="true" />
          <p className="mt-3 text-xs text-admin-muted">
            {loading ? 'Reading encrypted credential records…' : 'Credentials have not been loaded yet.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={onRefresh}
            className="mt-4"
          >
            Load credentials
          </Button>
        </div>
      )}
    </Modal>
  );
}

function CredentialGroup({
  title,
  subtitle,
  tone,
  badge,
  fields,
  explorerUrl,
  showSecrets,
}: {
  title: string;
  subtitle: string;
  tone: 'sky' | 'violet';
  badge: string;
  fields: Array<{ label: string; value: unknown; secret?: boolean }>;
  explorerUrl?: string;
  showSecrets: boolean;
}) {
  const toneClasses =
    tone === 'sky'
      ? 'border-sky-400/20 bg-sky-400/10 text-sky-300'
      : 'border-violet-400/20 bg-violet-400/10 text-violet-300';

  return (
    <div className="rounded-xl border border-admin-border bg-[#0A0E15] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-white">{title}</h3>
          <p className="mt-0.5 text-[11px] text-admin-faint">{subtitle}</p>
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${toneClasses}`}>
          {badge}
        </span>
      </div>

      <div className="mt-4 divide-y divide-white/[0.045]">
        {fields.map((field) => {
          const raw = typeof field.value === 'string' || typeof field.value === 'number'
            ? String(field.value)
            : '';
          const display =
            field.secret && !showSecrets
              ? maskSecret(raw)
              : raw.length > 44
                ? truncateMiddle(raw, 20, 12)
                : raw;
          return (
            <div key={field.label} className="py-2.5">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-admin-faint">
                  {field.label}
                </p>
                {field.secret && <Badge tone="warning">Sensitive</Badge>}
              </div>
              <div className="mt-1">
                {raw ? (
                  <CopyValue value={raw} display={display || '—'} label={`Copy ${field.label}`} />
                ) : (
                  <span className="font-admin-mono text-[11px] text-admin-faint">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-300 transition-colors hover:text-sky-200"
        >
          Verify on explorer
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
