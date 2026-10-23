import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Local-first: no remote image domains, no Vercel-specific features.
  images: { unoptimized: true },
};

export default config;
