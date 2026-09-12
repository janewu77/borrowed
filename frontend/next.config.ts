import type { NextConfig } from "next";

const apiOrigin = (process.env.API_ORIGIN ?? "https://borrowed-production-58eb.up.railway.app").replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/images/:path*", destination: `${apiOrigin}/images/:path*` },
    ];
  },
};

export default nextConfig;
