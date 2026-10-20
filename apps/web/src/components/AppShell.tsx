'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { AgentDeskPanel } from '@/components/AgentDeskPanel';
import { ThemeCustomizerModal } from '@/components/ThemeCustomizerModal';
import { VisualEffectsCanvas } from '@/components/VisualEffectsCanvas';
import { FloatingAIAgentWidget } from '@/components/FloatingAIAgentWidget';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [agentOpen, setAgentOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen relative overflow-x-hidden transition-colors duration-200">
      {/* Interactive 2D Visual Effects Background Canvas (Constellation / Starfield / Aurora) */}
      <VisualEffectsCanvas />

      {/* Subtle Micro-Grid Texture */}
      <div className="fixed inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:28px_28px] opacity-20 pointer-events-none z-0" />

      <div className="print:hidden sticky top-0 z-50">
        <SiteHeader />
      </div>

      <div className={`flex-1 w-full relative z-10 ${agentOpen ? 'pointer-events-none select-none overflow-hidden max-h-[calc(100vh-4rem)]' : ''}`}>{children}</div>

      <div className="print:hidden relative z-30">
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
