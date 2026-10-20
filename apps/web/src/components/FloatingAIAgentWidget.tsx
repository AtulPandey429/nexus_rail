'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, GripHorizontal } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { RobotMascot } from './RobotMascot';

interface FloatingAIAgentWidgetProps {
  onOpen: () => void;
  isOpen?: boolean;
}

const WELCOME_MESSAGES = [
  "👋 Hi! I'm your NexusRail AI Assistant.",
  "⚡ Verify live Stellar & XRPL multi-rail settlements.",
  "📦 Track orders & inspect cryptographic ledger proofs.",
  "💡 Ready to assist with dual-rail settlements!",
];

export function FloatingAIAgentWidget({ onOpen, isOpen = false }: FloatingAIAgentWidgetProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Widget coordinates state (default: bottom-right corner)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 28, y: 28 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // When chat box is open, hide floating widget completely so bot is docked at the chat panel top corner
  if (isOpen) return null;

  // Typewriter effect state
  const [messageIndex, setMessageIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const widgetRef = useRef<HTMLDivElement>(null);

  // Typewriter state-machine loop
  useEffect(() => {
    const fullMessage = WELCOME_MESSAGES[messageIndex];
    let timer: NodeJS.Timeout;

    if (!isDeleting) {
      if (currentText.length < fullMessage.length) {
        // Typing characters
        timer = setTimeout(() => {
          setCurrentText(fullMessage.slice(0, currentText.length + 1));
        }, 36);
      } else {
        // Full message typed: pause before backspacing
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 2600);
      }
    } else {
      if (currentText.length > 0) {
        // Deleting characters
        timer = setTimeout(() => {
          setCurrentText(currentText.slice(0, -1));
        }, 18);
      } else {
        // Message deleted: cycle to next message
        setIsDeleting(false);
        setMessageIndex((prev) => (prev + 1) % WELCOME_MESSAGES.length);
      }
    }

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, messageIndex]);

  // Load saved position on mount (NO annoying auto-popup on load; only on user hover)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexus_agent_widget_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setPosition({
            x: Math.min(Math.max(16, parsed.x), window.innerWidth - 90),
            y: Math.min(Math.max(16, parsed.y), window.innerHeight - 110),
          });
        }
      }
    } catch {}
  }, []);

  // 3D Parallax Mouse Tracking (tilts robot smoothly toward cursor)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!widgetRef.current) return;
      const rect = widgetRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const diffX = (e.clientX - centerX) / (window.innerWidth / 2);
      const diffY = (e.clientY - centerY) / (window.innerHeight / 2);

      setMouseOffset({
        x: Math.max(-14, Math.min(14, diffX * 16)),
        y: Math.max(-12, Math.min(12, -diffY * 14)),
      });
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
  }, []);

  // Drag start handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setHasDragged(false);
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;
    setHasDragged(false);
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.touches[0].clientX,
      mouseY: e.touches[0].clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  // Drag movement listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = dragStartRef.current.mouseX - e.clientX;
      const deltaY = dragStartRef.current.mouseY - e.clientY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        setHasDragged(true);
      }

      const newRight = Math.min(Math.max(16, dragStartRef.current.startX + deltaX), window.innerWidth - 90);
      const newBottom = Math.min(Math.max(16, dragStartRef.current.startY + deltaY), window.innerHeight - 110);

      setPosition({ x: newRight, y: newBottom });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      const deltaX = dragStartRef.current.mouseX - e.touches[0].clientX;
      const deltaY = dragStartRef.current.mouseY - e.touches[0].clientY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        setHasDragged(true);
      }

      const newRight = Math.min(Math.max(16, dragStartRef.current.startX + deltaX), window.innerWidth - 90);
      const newBottom = Math.min(Math.max(16, dragStartRef.current.startY + deltaY), window.innerHeight - 110);

      setPosition({ x: newRight, y: newBottom });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        try {
          localStorage.setItem('nexus_agent_widget_pos', JSON.stringify(position));
        } catch {}
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, position]);

  const handleClick = () => {
    if (!hasDragged) {
      onOpen();
    }
  };

  return (
    <div
      ref={widgetRef}
      style={{
        right: `${position.x}px`,
        bottom: `${position.y}px`,
      }}
      className="fixed z-50 select-none group touch-none"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Compact Speech Bubble (Emanates from the Mascot's mouth/face on hover only) */}
      <div
        className={`absolute right-[calc(100%+12px)] top-1 w-56 sm:w-60 p-3 rounded-2xl nexus-glass-card border border-[var(--border-highlight)] transition-all duration-300 origin-right z-50 ${
          showTooltip && !isDragging
            ? 'opacity-100 scale-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-x-2 pointer-events-none'
        }`}
        style={{
          boxShadow: isLight
            ? '0 12px 28px -6px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(217, 119, 6, 0.20)'
            : '0 16px 36px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(212, 175, 55, 0.30)',
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-[var(--gold)] uppercase tracking-wider">
              Nexus AI
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
            className="text-[var(--muted)] hover:text-[var(--foreground)] p-0.5 rounded hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
            aria-label="Close message"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Dynamic Typewriter Greeting Message */}
        <div className="pt-2 pb-2 min-h-[36px] flex items-start">
          <p className="text-[11px] text-[var(--foreground)] leading-relaxed font-sans">
            {currentText}
            <span className="inline-block w-1.5 h-3 ml-0.5 bg-[var(--gold)] align-middle animate-pulse" />
          </p>
        </div>

        {/* Footer Action */}
        <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border)]/60 text-[10px] font-mono">
          <span className="text-[var(--muted)] text-[9.5px]">Hover / Drag ↔</span>
          <button
            type="button"
            onClick={onOpen}
            className="px-2.5 py-0.5 rounded-lg bg-[var(--gold)] text-black font-bold hover:bg-[var(--gold-bright)] transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer text-[10px]"
          >
            <span>Open Desk</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Comic Chat Dialogue Arrow targeting the Mascot's mouth/face on the right */}
        <div
          className="absolute top-5 -right-1.5 w-3 h-3 bg-[var(--card)] border-t border-r border-[var(--border-highlight)] rotate-45 pointer-events-none"
          style={{
            backdropFilter: 'blur(var(--glass-blur))',
          }}
        />
      </div>

      {/* 3D Compact Holographic Mascot Container */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        className={`relative cursor-grab active:cursor-grabbing transition-transform duration-200 ${
          isDragging ? 'scale-105 opacity-90' : 'hover:scale-105 active:scale-95'
        }`}
        style={{
          perspective: '700px',
        }}
      >
        {/* Ambient Pedestal Glow */}
        <div
          className={`absolute -bottom-2 inset-x-0 h-4 rounded-full blur-md pointer-events-none transition-all duration-300 ${
            isLight ? 'bg-amber-500/20' : 'bg-cyan-400/30 animate-pulse'
          }`}
        />
        <div className="absolute -bottom-1 inset-x-2 h-2.5 bg-[var(--gold)]/20 rounded-full blur-sm pointer-events-none" />

        {/* 3D Tilted Mascot with Smooth Mouse Parallax */}
        <div
          className="relative transition-transform duration-150 ease-out animate-float-smooth flex flex-col items-center"
          style={{
            transform: `rotateY(${mouseOffset.x}deg) rotateX(${mouseOffset.y}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Vector Compact Mascot */}
          <div className="relative w-14 sm:w-16 h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]">
            <RobotMascot isLight={isLight} className="w-full h-auto" />
          </div>

          {/* Drag Handle Gripper Hint */}
          <div className="absolute -top-2 inset-x-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--card)]/90 border border-[var(--border)] text-[var(--gold)] shadow-sm">
              <GripHorizontal className="w-3 h-3" />
            </span>
          </div>

          {/* Online Live Status Indicator Dot */}
          <span className="absolute top-1 right-0 flex h-3 w-3 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-[var(--surface-solid)]" />
          </span>
        </div>
      </div>
    </div>
  );
}
