import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.3.87", "localhost", "127.0.0.1"],
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  transpilePackages: ["@vladmandic/face-api"],
};

export default nextConfig;
