import type { NextConfig } from "next";

// Inside Docker Compose weave-web proxies /api and /ws to the weave-server
// service so the browser can stay on the same origin. Outside Docker set
// NEXT_PUBLIC_API_URL and the rewrites are bypassed at build time.
const UPSTREAM = process.env.WEAVE_SERVER_UPSTREAM || "http://weave-server:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${UPSTREAM}/api/:path*` },
      { source: "/ws/:path*", destination: `${UPSTREAM}/ws/:path*` },
    ];
  },
};

export default nextConfig;
