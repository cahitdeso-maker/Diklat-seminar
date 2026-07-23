import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.3.87", "localhost", "127.0.0.1"],
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  transpilePackages: ["@vladmandic/face-api"],
  // Ensure the compressed chromium binary files (.br) are included in the
  // serverless function output for routes that need Puppeteer.
  // These binary assets (~65MB compressed) are not JavaScript modules so
  // Next.js output file tracing doesn't pick them up automatically.
  // Only scope to certificate routes to avoid bloating other functions.
  outputFileTracingIncludes: {
    "/api/certificates/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
