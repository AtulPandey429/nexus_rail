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
        'nexus-dark': '#0a0d14',
        'nexus-card': '#121824',
        'rail-emerald': '#10b981',
        'cyber-purple': '#8b5cf6',
        'stellar-cyan': '#06b6d4',
        'xrpl-blue': '#3b82f6',
      },
    },
  },
  plugins: [],
};

export default config;
