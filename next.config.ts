import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  outputFileTracingRoot: path.join(process.cwd()),
  // Run middleware on Node.js rather than the deprecated Edge runtime. The
  // signed admin session uses WebCrypto, which both runtimes provide. Next 15.5
  // honours this flag at build time but has not added it to ExperimentalConfig
  // yet, hence the cast.
  experimental: { nodeMiddleware: true } as unknown as NextConfig["experimental"]
};

export default nextConfig;
