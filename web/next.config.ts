import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'xlsx'],
  turbopack: {},
};

export default nextConfig;

