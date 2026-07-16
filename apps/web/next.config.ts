import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Compile the workspace TS packages (they ship source, not dist).
  transpilePackages: ['@stoliq/core', '@stoliq/ui-tokens'],
  experimental: {
    // Keep the guest bundle lean (perf budget <100KB JS, §8).
    optimizePackageImports: ['@stoliq/core'],
  },
};

export default nextConfig;
