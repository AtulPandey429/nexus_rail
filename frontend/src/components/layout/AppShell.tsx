'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { AgentDeskPanel } from '@/components/agent/AgentDeskPanel';
import { ThemeCustomizerModal } from '@/components/layout/ThemeCustomizerModal';
import { VisualEffectsCanvas } from '@/components/ui/VisualEffectsCanvas';
import { FloatingAIAgentWidget } from '@/components/agent/FloatingAIAgentWidget';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const [agentOpen, setAgentOpen] = useState(false);

  // Dedicated, distraction-free layout for Admin Operator Console
  if (isAdmin) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0B0E14] text-white antialiased">
        <main className="flex-1 w-full">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen relative overflow-x-hidden transition-colors duration-200">
      {/* Interactive 2D Visual Effects Background Canvas (Constellation / Starfield / Aurora) */}
      <VisualEffectsCanvas />

      {/* Subtle Micro-Grid Texture */}
      <div className="fixed inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:28px_28px] opacity-20 pointer-events-none z-0" />

      <div className="print:hidden fixed top-0 inset-x-0 z-50">
        <SiteHeader />
      </div>
      <div className="h-16 shrink-0 print:hidden" aria-hidden="true" />

      <div className={`flex-1 w-full relative z-10 ${agentOpen ? 'pointer-events-none select-none overflow-hidden max-h-[calc(100vh-4rem)]' : ''}`}>{children}</div>

      <div className="print:hidden relative z-10">
        <SiteFooter />
      </div>

      {/* Global Interface & Display Customizer Modal */}
      <ThemeCustomizerModal />

      {/* Prominent Draggable 3D Floating AI Desk Bot with Hover Welcome Message (Wraps into chat when opened) */}
      <div className="print:hidden">
        <FloatingAIAgentWidget onOpen={() => setAgentOpen(true)} isOpen={agentOpen} />
      </div>

      {/* Full-Screen AI Agent Desk */}
      <AgentDeskPanel isOpen={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}
