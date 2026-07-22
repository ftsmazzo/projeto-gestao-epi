import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@gestao-epi/shared'],
};

export default nextConfig;
