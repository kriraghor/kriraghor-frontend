import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { REDIRECTS } from "./src/lib/redirects";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // One image for every environment (ADR-003): a self-contained server, config read at runtime.
  output: "standalone",
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Old URLs (/tournaments, /t/…, /e/…) answer 308 to the new pages, before the proxy.
  async redirects() {
    return REDIRECTS;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          // M23: only the stream players may be framed (built from parsed video ids), and nobody frames us.
          { key: "Content-Security-Policy", value: "frame-src https://www.youtube-nocookie.com https://www.facebook.com; frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
