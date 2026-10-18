'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { AgentDeskPanel } from '@/components/AgentDeskPanel';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [agentOpen, setAgentOpen] = useState(false);

  return (
    <>
      <SiteHeader />
      {children}
      <button
        type="button"
        onClick={() => setAgentOpen(true)}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-2xl bg-cyber-purple text-white text-sm font-semibold shadow-lg inline-flex items-center gap-2"
      >
        <Sparkles className="w-4 h-4" />
        Ask the assistant
      </button>
      <AgentDeskPanel isOpen={agentOpen} onClose={() => setAgentOpen(false)} />
    </>
  );
}
