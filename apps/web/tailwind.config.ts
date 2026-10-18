import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'nexus-dark': '#08090D',
        'nexus-surface': '#0B0D14',
        'nexus-card': '#11141D',
        'nexus-card-subtle': '#141824',
        'nexus-border': '#1D2230',
        'nexus-border-focus': '#2B3347',
        'rail-emerald': '#10B981',
        'rail-mint': '#34D399',
        'cyber-purple': '#A855F7',
        'stellar-cyan': '#38BDF8',
        'xrpl-blue': '#60A5FA',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': "linear-gradient(to right, #1a202c10 1px, transparent 1px), linear-gradient(to bottom, #1a202c10 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

export default config;
