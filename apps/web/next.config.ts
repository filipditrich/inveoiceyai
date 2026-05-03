import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@invoicey/ares", "@invoicey/db", "@invoicey/invoice-core"],
};

export default nextConfig;
