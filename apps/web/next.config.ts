import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@nexusrail/shared'],
  reactStrictMode: true,
};

export default nextConfig;
