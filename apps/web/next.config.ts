import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@invoicey/ares",
    "@invoicey/db",
    "@invoicey/env",
    "@invoicey/invoice-core",
  ],
};

export default nextConfig;
