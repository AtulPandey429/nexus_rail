import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NexusRail — Multi-Rail Commerce & AI Agent Desk',
  description: 'Enterprise Flagship Commerce Engine combining Stripe, XRPL, Stellar, and Sub-300ms AI Agent Desk.',
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
      <body className="bg-nexus-dark text-gray-100 antialiased selection:bg-rail-emerald/30">
        {children}
      </body>
    </html>
  );
}
