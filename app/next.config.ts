import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wallet adapter React UI requires transpilation for ESM compatibility
  transpilePackages: ["@solana/wallet-adapter-react-ui"],

  // Next.js 16 uses Turbopack by default.
  // @solana/web3.js Node.js built-ins are not needed in the browser;
  // Turbopack automatically excludes Node-only modules via browser target.
  // Empty turbopack config satisfies the requirement without webpack migration.
  turbopack: {},
};

export default nextConfig;
