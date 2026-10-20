import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'nexus-bg': '#141619',
        'nexus-dark': '#141619',
        'nexus-surface': '#1C1F24',
        'nexus-card': '#26282C',
        'nexus-card-subtle': '#1F2226',
        'nexus-border': '#3D4148',
        'nexus-border-focus': '#D4AF37',
        'nexus-gold': '#D4AF37',
        'nexus-gold-bright': '#E8CE90',
        'nexus-text': '#F2E8D3',
        'nexus-muted': '#A69E8D',
        'rail-emerald': '#D4AF37',
        'rail-mint': '#F2D675',
        'cyber-purple': '#D4AF37',
        'stellar-cyan': '#00E5FF',
        'xrpl-blue': '#0081F2',
        'state-success': '#10B981',
        'state-error': '#EF4444',
        'state-warning': '#F59E0B',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(to right, #1a202c10 1px, transparent 1px), linear-gradient(to bottom, #1a202c10 1px, transparent 1px)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 3s infinite',
        'pulse-slow': 'pulse-slow 4s ease-in-out infinite',
        'gradient-x': 'gradient-x 8s ease infinite',
        'shimmer': 'shimmer 2.5s infinite linear',
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow': 'glow 3s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 15px rgba(16, 185, 129, 0.15)' },
          '100%': { boxShadow: '0 0 30px rgba(16, 185, 129, 0.35)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
