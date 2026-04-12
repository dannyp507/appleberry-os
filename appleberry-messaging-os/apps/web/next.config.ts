import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_APP_BASE_PATH?.trim() || undefined;

const nextConfig: NextConfig = {
  basePath,
  typedRoutes: true,
};

export default nextConfig;
