import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'NexusRail',
  description: 'Shop catalog, cart, and checkout through the NexusRail API.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-nexus-dark text-gray-100 antialiased selection:bg-rail-emerald/30`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
