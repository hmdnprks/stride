import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Files read from disk at request time; make sure they ship with their routes.
  outputFileTracingIncludes: {
    "/api/card/[kind]/[id]": ["./public/fonts/*.ttf"],
    // The map's worker is read from the package at request time.
    "/maplibre-worker": ["./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"],
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
