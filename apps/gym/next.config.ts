import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// The repo root (npm workspaces): packages/* are compiled from source and traced into the standalone build.
const root = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  // One image for every environment (ADR-003): a self-contained server, config read at runtime.
  output: "standalone",
  outputFileTracingRoot: root,
  transpilePackages: ["@kriraghor/session", "@kriraghor/api-client", "@kriraghor/ui"],
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // The front desk scans pass QR codes with the camera (M20 §5).
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
