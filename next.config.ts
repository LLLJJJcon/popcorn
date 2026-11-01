import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { dev }) {
    // Next 16.3.1's persisted Webpack snapshots can contain an undefined hash
    // after the verification suite. Keep repeat production builds reliable;
    // development retains Next's normal incremental cache.
    if (!dev) config.cache = false;
    return config;
  },
};

export default nextConfig;
