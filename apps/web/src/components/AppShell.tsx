'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { AgentDeskPanel } from '@/components/AgentDeskPanel';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [agentOpen, setAgentOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen transition-colors duration-200">
      <SiteHeader />
      <div className="flex-1 w-full">{children}</div>
      <SiteFooter />
      <button
        type="button"
        onClick={() => setAgentOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white/90 dark:bg-nexus-card/90 border border-cyber-purple/50 text-cyber-purple hover:bg-cyber-purple/10 text-xs font-mono font-bold shadow-2xl inline-flex items-center gap-2 backdrop-blur-md transition-all hover:scale-105 active:scale-95 animate-pulse-slow"
        aria-label="Open AI Agent Desk"
      >
        <Sparkles className="w-4 h-4 text-cyber-purple animate-spin-once" />
        <span className="hidden xs:inline">AI Agent Desk</span>
        <span className="xs:hidden">AI Desk</span>
      </button>
      <AgentDeskPanel isOpen={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}
