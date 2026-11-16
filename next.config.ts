import type { NextConfig } from "next";

/**
 * `ELECTRON_BUILD=1` switches on `output: "standalone"`, which emits a
 * self-contained `.next/standalone/server.js` that the Electron main process
 * spawns. It is off for normal `npm run dev` / `npm run build` so the Vercel
 * deployment keeps its usual serverless output.
 *
 * `outputFileTracingRoot` is pinned to this project on purpose. Next walks up
 * looking for a lockfile to infer a workspace root, and this project lives
 * directly under the user's home directory — which has an unrelated
 * `package.json`/`package-lock.json`. Left alone, Next treats `~` as the root,
 * warns about it, and nests the output at `.next/standalone/<dirname>/server.js`
 * instead of `.next/standalone/server.js`, which breaks the packaging script.
 */
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the dev-tools bubble — it overlaps the sidebar footer and ends up in
  // every screenshot. Dev only; has no effect on a production build.
  devIndicators: false,
  ...(process.env.ELECTRON_BUILD === "1"
    ? {
        output: "standalone" as const,
        outputFileTracingRoot: projectRoot,
      }
    : {}),
};

export default nextConfig;
