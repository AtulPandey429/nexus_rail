'use client';

import React from 'react';

interface RobotMascotProps {
  isLight?: boolean;
  className?: string;
}

export function RobotMascot({ isLight = false, className = 'w-16 h-auto sm:w-20' }: RobotMascotProps) {
  // Theme-Adaptive Color Schemes:
  // Light Theme -> Dark/Graphite Robot with Gold Accents
  // Dark Theme  -> Light/Platinum Robot with Cyan & Gold Accents
  const colors = isLight
    ? {
        primary0: '#334155',
        primary45: '#1E293B',
        primary100: '#0F172A',
        deep0: '#1E293B',
        deep100: '#020617',
        accent0: '#F59E0B',
        accent50: '#D97706',
        accent100: '#B45309',
        chrome0: '#F8FAFC',
        chrome40: '#E2E8F0',
        chrome80: '#94A3B8',
        chrome100: '#64748B',
        darkMetal0: '#334155',
        darkMetal100: '#0F172A',
        strokeOuter: '#475569',
        screenBg0: '#0F172A',
        screenBg100: '#020617',
        eyeColor: '#0284C7',
        pedestalGlass: '#CBD5E1',
        pedestalRing: '#D97706',
        glowCyan: '#0284C7',
        glowOrange: '#D97706',
        nrLogo: '#D97706',
      }
    : {
        primary0: '#FFFFFF',
        primary45: '#E2E8F0',
        primary100: '#CBD5E1',
        deep0: '#E2E8F0',
        deep100: '#64748B',
        accent0: '#FBBF24',
        accent50: '#F59E0B',
        accent100: '#D97706',
        chrome0: '#FFFFFF',
        chrome40: '#F1F5F9',
        chrome80: '#CBD5E1',
        chrome100: '#94A3B8',
        darkMetal0: '#334155',
        darkMetal100: '#0F172A',
        strokeOuter: '#E2E8F0',
        screenBg0: '#0A0F1D',
        screenBg100: '#030712',
        eyeColor: '#00E5FF',
        pedestalGlass: '#38BDF8',
        pedestalRing: '#F59E0B',
        glowCyan: '#00E5FF',
        glowOrange: '#F59E0B',
        nrLogo: '#F59E0B',
      };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 800 900"
      className={`${className} transition-all duration-300 pointer-events-none select-none`}
      aria-label="NexusRail 3D AI Robot Mascot"
    >
      <defs>
        {/* Glow Filters */}
        <filter id="rm-ground-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="24" result="blur" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.12  0 0 0 0 0.22  0 0 0 0.25 0" />
        </filter>

        <filter id="rm-drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="20" stdDeviation="18" floodColor="#0f172a" floodOpacity="0.30" />
        </filter>

        <filter id="rm-neon-cyan" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur1" />
          <feGaussianBlur stdDeviation="12" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="rm-neon-orange" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Theme-Adaptive Gradients */}
        <linearGradient id="rm-primary-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary0} />
          <stop offset="45%" stopColor={colors.primary45} />
          <stop offset="100%" stopColor={colors.primary100} />
        </linearGradient>

        <linearGradient id="rm-deep-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.deep0} />
          <stop offset="100%" stopColor={colors.deep100} />
        </linearGradient>

        <linearGradient id="rm-accent-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.accent0} />
          <stop offset="50%" stopColor={colors.accent50} />
          <stop offset="100%" stopColor={colors.accent100} />
        </linearGradient>

        <linearGradient id="rm-chrome-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.chrome0} />
          <stop offset="40%" stopColor={colors.chrome40} />
          <stop offset="80%" stopColor={colors.chrome80} />
          <stop offset="100%" stopColor={colors.chrome100} />
        </linearGradient>

        <linearGradient id="rm-dark-metal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.darkMetal0} />
          <stop offset="100%" stopColor={colors.darkMetal100} />
        </linearGradient>

        <linearGradient id="rm-pedestal-glass" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={colors.pedestalGlass} stopOpacity="0.8" />
          <stop offset="50%" stopColor={colors.pedestalGlass} stopOpacity="0.25" />
          <stop offset="100%" stopColor={colors.pedestalGlass} stopOpacity="0.7" />
        </linearGradient>

        <radialGradient id="rm-screen-bg" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor={colors.screenBg0} />
          <stop offset="100%" stopColor={colors.screenBg100} />
        </radialGradient>
      </defs>

      {/* 1. Ambient Drop Shadow on Floor */}
      <ellipse cx="400" cy="820" rx="230" ry="36" fill="#0f172a" filter="url(#rm-ground-shadow)" />

      {/* 2. Dual-Layer Levitation Pedestal */}
      <g id="pedestal">
        <ellipse cx="400" cy="790" rx="160" ry="32" fill="url(#rm-chrome-grad)" />
        <ellipse cx="400" cy="786" rx="156" ry="29" fill="url(#rm-dark-metal)" />
        
        {/* Glowing Core Ring */}
        <ellipse
          cx="400"
          cy="770"
          rx="145"
          ry="26"
          fill="none"
          stroke="url(#rm-accent-grad)"
          strokeWidth="5"
          filter="url(#rm-neon-orange)"
          transform="rotate(-4 400 770)"
        />

        {/* Platform Disk */}
        <ellipse
          cx="400"
          cy="746"
          rx="195"
          ry="36"
          fill="url(#rm-pedestal-glass)"
          stroke={colors.strokeOuter}
          strokeWidth="3"
          transform="rotate(-6 400 746)"
        />
        <ellipse
          cx="400"
          cy="746"
          rx="170"
          ry="30"
          fill="none"
          stroke={colors.glowCyan}
          strokeWidth="2"
          opacity="0.9"
          filter="url(#rm-neon-cyan)"
          transform="rotate(-6 400 746)"
        />
      </g>

      {/* 3. Character Body */}
      <g id="robot-character" filter="url(#rm-drop-shadow)">
        {/* Left Leg */}
        <g id="left-leg">
          <ellipse cx="465" cy="635" rx="20" ry="34" fill="url(#rm-primary-grad)" transform="rotate(-15 465 635)" />
          <ellipse cx="480" cy="680" rx="15" ry="26" fill="url(#rm-chrome-grad)" transform="rotate(10 480 680)" />
          <path d="M 466 702 C 472 688, 502 690, 505 704 C 507 718, 466 720, 466 702 Z" fill="url(#rm-dark-metal)" />
        </g>

        {/* Right Leg */}
        <g id="right-leg">
          <circle cx="375" cy="590" r="14" fill="url(#rm-accent-grad)" />
          <ellipse cx="380" cy="640" rx="22" ry="36" fill="url(#rm-primary-grad)" transform="rotate(10 380 640)" />
          <ellipse cx="390" cy="692" rx="17" ry="28" fill="url(#rm-chrome-grad)" transform="rotate(-5 390 692)" />
          <path d="M 374 716 C 380 700, 416 702, 418 718 C 420 732, 374 734, 374 716 Z" fill="url(#rm-dark-metal)" />
        </g>

        {/* Waist & Belt */}
        <path d="M 360 560 Q 400 580 440 560 L 442 585 Q 400 605 358 585 Z" fill="url(#rm-accent-grad)" />

        {/* Torso Armor */}
        <g id="torso">
          {/* Outer Shell */}
          <path
            d="M 330 450 C 330 415, 470 415, 470 450 C 476 515, 456 570, 400 575 C 344 570, 324 515, 330 450 Z"
            fill="url(#rm-primary-grad)"
          />
          
          {/* Center Chrome Plate */}
          <path
            d="M 356 460 C 356 440, 444 440, 444 460 C 448 500, 436 540, 400 545 C 364 540, 352 500, 356 460 Z"
            fill="url(#rm-chrome-grad)"
          />

          {/* Glowing Power Core */}
          <rect x="382" y="482" width="36" height="36" rx="10" fill="url(#rm-dark-metal)" stroke={colors.accent0} strokeWidth="2" />
          <path
            d="M 400 490 L 400 499 M 393 495 A 7 7 0 1 0 407 495"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#rm-neon-orange)"
          />
        </g>

        {/* Left Arm */}
        <g id="left-arm">
          <circle cx="480" cy="450" r="24" fill="url(#rm-primary-grad)" />
          <circle cx="480" cy="450" r="14" fill="url(#rm-accent-grad)" />
          <ellipse cx="512" cy="505" rx="17" ry="30" fill="url(#rm-accent-grad)" transform="rotate(-20 512 505)" />
          <circle cx="530" cy="550" r="14" fill="url(#rm-chrome-grad)" />
          <path d="M 522 558 C 532 580, 546 575, 538 555" stroke="url(#rm-dark-metal)" strokeWidth="9" strokeLinecap="round" fill="none" />
        </g>

        {/* Right Arm (Thumbs-up) */}
        <g id="right-arm">
          <circle cx="320" cy="450" r="24" fill="url(#rm-primary-grad)" />
          <circle cx="320" cy="450" r="14" fill="url(#rm-accent-grad)" />
          <path d="M 315 455 Q 275 490, 270 430" fill="none" stroke="url(#rm-accent-grad)" strokeWidth="28" strokeLinecap="round" />
          <circle cx="270" cy="425" r="17" fill="url(#rm-chrome-grad)" />
          <ellipse cx="264" cy="415" rx="16" ry="18" fill="url(#rm-dark-metal)" />
          <path d="M 264 415 Q 262 370, 275 365 C 285 362, 290 378, 280 405 Z" fill="url(#rm-chrome-grad)" />
          <line x1="256" y1="410" x2="270" y2="410" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="256" y1="417" x2="270" y2="417" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="258" y1="424" x2="268" y2="424" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* 4. Head & Face */}
        <g id="head">
          {/* Antennas */}
          <path d="M 315 240 L 298 160" stroke="url(#rm-primary-grad)" strokeWidth="10" strokeLinecap="round" />
          <circle cx="298" cy="160" r="8" fill="url(#rm-accent-grad)" stroke="#FFFFFF" strokeWidth="2" />
          
          <path d="M 485 240 L 502 160" stroke="url(#rm-primary-grad)" strokeWidth="10" strokeLinecap="round" />
          <circle cx="502" cy="160" r="8" fill="url(#rm-accent-grad)" stroke="#FFFFFF" strokeWidth="2" />

          {/* Ear Pods */}
          <rect x="285" y="235" width="30" height="75" rx="15" fill="url(#rm-chrome-grad)" />
          <circle cx="300" cy="272" r="16" fill="url(#rm-primary-grad)" />
          <circle cx="300" cy="272" r="9" fill="url(#rm-accent-grad)" />

          <rect x="485" y="235" width="30" height="75" rx="15" fill="url(#rm-chrome-grad)" />
          <circle cx="500" cy="272" r="16" fill="url(#rm-primary-grad)" />
          <circle cx="500" cy="272" r="9" fill="url(#rm-accent-grad)" />

          {/* Outer Helmet */}
          <rect
            x="300"
            y="190"
            width="200"
            height="180"
            rx="64"
            fill="url(#rm-primary-grad)"
            stroke={colors.strokeOuter}
            strokeWidth="3"
          />
          
          {/* Upper Visor Cap with NR Badge */}
          <path d="M 318 220 C 338 180, 462 180, 482 220 L 476 250 C 450 236, 350 236, 324 250 Z" fill="url(#rm-deep-grad)" />
          <text
            x="400"
            y="235"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="25"
            fill={colors.nrLogo}
            textAnchor="middle"
            letterSpacing="2"
            filter="url(#rm-neon-orange)"
          >
            NR
          </text>

          {/* Glass Visor Face Screen */}
          <rect x="320" y="240" width="160" height="110" rx="38" fill="url(#rm-screen-bg)" stroke="#1E293B" strokeWidth="3" />

          {/* Visor Gloss Reflection */}
          <path d="M 330 250 C 360 245, 440 245, 470 250 C 450 264, 350 264, 330 250 Z" fill="#FFFFFF" opacity="0.2" />

          {/* Expressive Glowing Face */}
          {/* Left Eye (Open Eye) */}
          <circle cx="360" cy="290" r="12" fill={colors.eyeColor} filter="url(#rm-neon-cyan)" />
          
          {/* Right Eye (Joyful Wink) */}
          <path
            d="M 422 290 Q 436 278, 450 290"
            fill="none"
            stroke={colors.eyeColor}
            strokeWidth="5.5"
            strokeLinecap="round"
            filter="url(#rm-neon-cyan)"
          />

          {/* Smiling Mouth */}
          <path
            d="M 386 316 Q 400 328, 414 316"
            fill="none"
            stroke={colors.eyeColor}
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#rm-neon-cyan)"
          />

          {/* Cheeks Blush Accent */}
          <circle cx="344" cy="308" r="5" fill={colors.accent0} filter="url(#rm-neon-orange)" />
          <circle cx="456" cy="308" r="5" fill={colors.accent0} filter="url(#rm-neon-orange)" />
        </g>

        {/* Sparkle Nodes */}
        <ellipse
          cx="400"
          cy="175"
          rx="145"
          ry="18"
          fill="none"
          stroke={colors.glowCyan}
          strokeWidth="2"
          strokeDasharray="8 6"
          opacity="0.6"
          transform="rotate(-8 400 175)"
        />
        <circle cx="308" cy="165" r="4.5" fill={colors.accent0} filter="url(#rm-neon-orange)" />
        <circle cx="494" cy="186" r="4.5" fill={colors.glowCyan} filter="url(#rm-neon-cyan)" />
      </g>
    </svg>
  );
}
