import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow the local SDK package to be transpiled
  transpilePackages: ['@mission_sciences/provider-sdk'],
};

export default nextConfig;
