/**
 * Tailwind CSS configuration for PMS.
 *
 * We keep this minimal during scaffolding. As shadcn/ui is added, we'll extend
 * theme tokens here (colors, radius, etc.) in a centralized way.
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;

