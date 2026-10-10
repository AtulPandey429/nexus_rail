import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@nexusrail/shared'],
  reactStrictMode: true,
  async rewrites() {
    // On Vercel, do not attempt to proxy to localhost:4000 (causes DNS_HOSTNAME_RESOLVED_PRIVATE 404).
    // Let Next.js App Router API Route Handlers in /app/api/v1 handle requests natively.
    if (process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV) {
      return [];
    }
    if (process.env.API_SERVER_URL) {
      return [
        {
          source: '/api/v1/:path*',
          destination: `${process.env.API_SERVER_URL}/api/v1/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
