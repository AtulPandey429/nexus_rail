import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';

const adminMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-admin-mono',
});

export const metadata: Metadata = {
  title: 'Operator Console | NexusRail',
  description: 'Restricted NexusRail dual-rail settlement and treasury operations console.',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${adminMono.variable} admin-scope`}>{children}</div>;
}
