import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'xlsx'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // No intentar resolver módulos de Node.js en el bundle del cliente
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
  },
};

export default nextConfig;
