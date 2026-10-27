import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Content is static markdown read at build time, so classic static
  // generation is all we need. Cache Components stays off on purpose.
  outputFileTracingIncludes: {
    "/**": ["./content/**/*"],
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
