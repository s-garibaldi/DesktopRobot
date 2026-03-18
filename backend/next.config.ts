import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Force tracing root to this workspace to avoid lockfile/root mis-detection
  // that can lead to inconsistent server chunk outputs.
  outputFileTracingRoot: path.join(__dirname, ".."),
  // Keep dev artifacts isolated from production build artifacts to avoid
  // intermittent ENOENT errors when .next contents are churned.
  distDir: process.env.NEXT_DEV_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async headers() {
    return [
      {
        // Apply CORS headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Allow all origins for development
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
