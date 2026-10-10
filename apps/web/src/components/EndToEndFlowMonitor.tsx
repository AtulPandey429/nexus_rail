'use client';

import React from 'react';
import { ShoppingBag, ArrowRight, CheckCircle2, CreditCard, Bell, ShieldCheck } from 'lucide-react';

export interface EndToEndStepProps {
  currentStage: 1 | 2 | 3 | 4 | 5;
  orderId?: string;
  selectedRail?: string;
}

export function EndToEndFlowMonitor({ currentStage, orderId, selectedRail = 'STRIPE' }: EndToEndStepProps) {
  const steps = [
    { stage: 1, label: '1. Cart Created', sub: 'Order PENDING', icon: ShoppingBag },
    { stage: 2, label: '2. Rail Selection', sub: selectedRail || 'Select Rail', icon: CreditCard },
    { stage: 3, label: '3. Enter Credentials', sub: 'Payment Portal', icon: CreditCard },
    { stage: 4, label: '4. Webhook Triggered', sub: 'checkout.session.completed', icon: Bell },
    { stage: 5, label: '5. Order Confirmed', sub: 'Status: PAID', icon: CheckCircle2 },
  ];

  return (
    <div className="p-4 rounded-2xl bg-[#131927] border border-gray-800 shadow-xl space-y-3 font-mono text-xs text-white">
      <div className="flex justify-between items-center border-b border-gray-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rail-emerald animate-pulse" />
          <span className="font-bold text-rail-emerald tracking-wide">NexusRail End-to-End Pipeline Monitor</span>
        </div>
        {orderId && (
          <span className="text-[11px] text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
            Order ID: <strong className="text-white">{orderId}</strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 pt-1">
        {steps.map((s) => {
          const isPassed = currentStage >= s.stage;
          const isCurrent = currentStage === s.stage;
          const Icon = s.icon;

          return (
            <div
              key={s.stage}
              className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all ${
                isCurrent
                  ? 'bg-rail-emerald/15 border-rail-emerald text-white shadow-lg shadow-rail-emerald/10'
                  : isPassed
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400'
                  : 'bg-gray-900/40 border-gray-800/60 text-gray-500'
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-rail-emerald' : isPassed ? 'text-emerald-400' : 'text-gray-500'}`} />
                {isPassed && s.stage < currentStage && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </div>
              <div className="font-bold text-[11px] truncate w-full">{s.label}</div>
              <div className="text-[9px] text-gray-400 truncate w-full mt-0.5">{s.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
