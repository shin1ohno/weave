import type { NextConfig } from "next";

// Inside Docker Compose weave-web proxies /api and /ws to the weave-server
// service so the browser can stay on the same origin. Outside Docker set
// NEXT_PUBLIC_API_URL and the rewrites are bypassed at build time.
const UPSTREAM = process.env.WEAVE_SERVER_UPSTREAM || "http://weave-server:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev-only: let the dev server's HMR socket accept requests from the
  // machine's LAN hostname in addition to localhost. Ignored in production.
  allowedDevOrigins: ["pro.home.local", "pro.local"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${UPSTREAM}/api/:path*` },
      { source: "/ws/:path*", destination: `${UPSTREAM}/ws/:path*` },
    ];
  },
  async redirects() {
    // Live Console absorbed the former Overview / Mappings / Edges pages.
    // Old glyph URLs now live under /g. Keep bookmarks alive with 301s.
    return [
      { source: "/edges", destination: "/", permanent: true },
      { source: "/mappings", destination: "/", permanent: true },
      {
        source: "/mappings/:id",
        destination: "/mappings/:id/edit",
        permanent: true,
      },
      { source: "/glyphs", destination: "/g", permanent: true },
      { source: "/glyphs/:name", destination: "/g/:name", permanent: true },
    ];
  },
};

export default nextConfig;
