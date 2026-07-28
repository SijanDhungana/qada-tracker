import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "postgres"],
  // TypeScript 7 no longer exposes the compiler API Next.js used to call into.
  experimental: {
    useTypeScriptCli: true,
  },
};

export default nextConfig;
