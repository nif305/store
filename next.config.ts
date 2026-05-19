import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: false,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;