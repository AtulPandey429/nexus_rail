'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FX_CHANGE_EVENT, type FxMode, readFxMode } from '@/lib/visual-fx';
import { useTheme } from './ThemeProvider';

export function VisualEffectsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fxMode, setFxMode] = useState<FxMode>(readFxMode);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const { theme } = useTheme();

  // Listen for FX mode changes across the application
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<FxMode>).detail;
      if (detail) setFxMode(detail);
      else setFxMode(readFxMode());
    };
    window.addEventListener(FX_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(FX_CHANGE_EVENT, onChange);
  }, []);

  // Track mouse coordinates for interactive cursor beam
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    if (fxMode === 'off') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize, { passive: true });

    // Performance optimization: pause when browser tab is inactive
    let isVisible = !document.hidden;
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const isLight = theme === 'light';
    const particleCount = fxMode === 'starfield' ? 140 : 70;

    // Dual-rail colors: Rich Amber Gold, Vibrant Sapphire, Emerald & Slate
    const colors = isLight
      ? ['#D97706', '#0284C7', '#059669', '#1E293B', '#7C3AED']
      : ['#00E5FF', '#D4AF37', '#7FF8C6', '#818CF8'];

    const particles = Array.from({ length: particleCount }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * width,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      size: isLight ? Math.random() * 2.6 + 2.0 : Math.random() * 2 + 1,
      alpha: Math.random() * 0.4 + 0.6,
      color: colors[idx % colors.length],
    }));

    let waveTime = 0;

    const render = () => {
      if (!isVisible) return;

      // Mouse lerp smoothing
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const accentHex =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--accent')
          .trim() || (isLight ? '#0284C7' : '#00E5FF');

      const goldHex =
        getComputedStyle(document.documentElement)
          .getPropertyValue('--gold')
          .trim() || (isLight ? '#D97706' : '#D4AF37');

      if (fxMode === 'constellation') {
        // Multi-rail Network Constellation Nodes with Proximity Lines & Interactive Cursor Beams
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          // Render node circle with crisp presence
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = isLight ? 0.95 : 0.80;
          ctx.fill();

          // Inter-node connection lines
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 22500) { // 150px range
              const dist = Math.sqrt(distSq);
              ctx.beginPath();
              ctx.lineWidth = isLight ? 1.6 : 1.0;
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = i % 2 === 0 ? accentHex : goldHex;
              ctx.globalAlpha = isLight
                ? (1 - dist / 150) * 0.65
                : (1 - dist / 150) * 0.28;
              ctx.stroke();
            }
          }

          // Interactive Cursor Beam (Connects nearby nodes to the mouse pointer with glowing magnetic beam)
          const mdx = p.x - mouseRef.current.x;
          const mdy = p.y - mouseRef.current.y;
          const mdistSq = mdx * mdx + mdy * mdy;

          if (mdistSq < 36100) { // 190px range
            const mdist = Math.sqrt(mdistSq);
            ctx.beginPath();
            ctx.lineWidth = isLight ? 2.2 : 1.4;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = isLight
              ? (1 - mdist / 190) * 0.80
              : (1 - mdist / 190) * 0.50;
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.0;
      } else if (fxMode === 'starfield') {
        // Hyperspace 3D Warp Starfield
        const cx = width / 2;
        const cy = height / 2;
        for (const p of particles) {
          p.z -= 7;
          if (p.z <= 0) {
            p.z = width;
            p.x = Math.random() * width;
            p.y = Math.random() * height;
          }
          const k = 128 / p.z;
          const px = (p.x - cx) * k + cx;
          const py = (p.y - cy) * k + cy;
          const size = (1 - p.z / width) * (isLight ? 3.2 : 2.5);

          ctx.beginPath();
          ctx.arc(px, py, Math.max(0.3, size), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = isLight
            ? (1 - p.z / width) * 0.95
            : (1 - p.z / width) * 0.85;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (fxMode === 'waves') {
        // Ambient Flowing Luminous Aurora Wave Gradient
        waveTime += 0.008;
        const gradient = ctx.createRadialGradient(
          mouseRef.current.x || width * 0.5,
          mouseRef.current.y || height * 0.4,
          40,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.7
        );
        gradient.addColorStop(0, accentHex);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = isLight
          ? 0.16 + Math.sin(waveTime) * 0.05
          : 0.12 + Math.sin(waveTime) * 0.04;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fxMode, theme]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Ambient Floating Lighting Orbs */}
      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />

      {/* Interactive 2D Visual Effects Canvas */}
      {fxMode !== 'off' && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-700"
        />
      )}
    </div>
  );
}
