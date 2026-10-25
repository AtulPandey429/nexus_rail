import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/app', destination: '/profile' },
      { source: '/app/:path*', destination: '/:path*' },
    ];
  },
};

export default nextConfig;
