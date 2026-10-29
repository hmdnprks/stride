import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The share cards read their fonts from disk; make sure they ship with the route.
  outputFileTracingIncludes: {
    "/api/card/[kind]/[id]": ["./public/fonts/*.ttf"],
  },
  experimental: {
    // Offline detection (the header's "Offline" state) and automatic retry
    // of navigations and actions once the connection is back.
    useOffline: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
