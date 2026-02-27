import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    // Use wsrv.nl as external image optimization proxy for static export
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.ts',
  },
};

export default nextConfig;
