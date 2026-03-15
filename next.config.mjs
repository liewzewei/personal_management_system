/**
 * Next.js configuration for PMS.
 *
 * Keep this minimal during scaffolding. Add settings here only when we have a
 * clear production need (images domains, redirects, headers, etc.).
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["node-ical"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
};

export default nextConfig;

