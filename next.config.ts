import type { NextConfig } from "next";

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['mssql'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'mssql': false,
      };
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
