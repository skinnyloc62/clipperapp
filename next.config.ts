import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the dev-tools bubble — it overlaps the sidebar footer and ends up in
  // every screenshot. Dev only; has no effect on a production build.
  devIndicators: false,
};

export default nextConfig;
