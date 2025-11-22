import type { NextConfig } from "next";

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  serverExternalPackages: ['jsdom', 'mssql'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'jsdom': false,
        'mssql': false,
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
