'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { AgentDeskPanel } from '@/components/AgentDeskPanel';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [agentOpen, setAgentOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <button
        type="button"
        onClick={() => setAgentOpen(true)}
        className="fixed bottom-6 right-6 z-40 px-3.5 py-2.5 rounded-xl bg-nexus-card border border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/10 text-xs font-mono font-bold shadow-2xl inline-flex items-center gap-2 backdrop-blur-md transition-all hover:scale-105"
      >
        <Sparkles className="w-4 h-4 text-cyber-purple" />
        <span>AI Agent Desk</span>
      </button>
      <AgentDeskPanel isOpen={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}
