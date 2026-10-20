import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SmoothScroll } from '@/components/SmoothScroll';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'NexusRail | Multi-Rail Crypto Commerce Engine',
  description: 'Shop catalog, cart, and dual-rail settlement through Stellar and XRPL ledger rails.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo-icon.webp', type: 'image/webp' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/logo-256.png', sizes: '256x256' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-[var(--background)] text-[var(--foreground)] antialiased selection:bg-rail-emerald/30 min-h-screen flex flex-col`}>
        {/* Subtle Cinematic Film Grain Texture (Adapted from atul-portfolio) */}
        <div className="site-grain pointer-events-none fixed inset-0 z-[1]" aria-hidden="true" />
        <ThemeProvider>
          <SmoothScroll>
            <AppShell>{children}</AppShell>
          </SmoothScroll>
        </ThemeProvider>
      </body>
    </html>
  );
}
