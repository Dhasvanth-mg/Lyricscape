import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Local-first: no remote image domains, no Vercel-specific features.
  images: { unoptimized: true },
  // The app is opened at 127.0.0.1 (Spotify requires it); let `next dev` serve HMR/chunks there.
  allowedDevOrigins: ['127.0.0.1'],
};

export default config;
