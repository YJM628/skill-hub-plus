import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: '/Users/junmengye/CodePilot/chat-panel-fullstack',
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
};

export default nextConfig;