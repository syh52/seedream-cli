import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.bytepluses.com',
      },
      {
        protocol: 'https',
        hostname: '*.byteimg.com',
      },
      {
        protocol: 'https',
        hostname: '**.volces.com',
      },
      {
        protocol: 'https',
        hostname: 'ark-content-generation-v2-ap-southeast-1.tos-ap-southeast-1.volces.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
    // Optimize loading performance
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
