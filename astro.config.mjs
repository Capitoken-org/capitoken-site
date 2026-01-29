import { defineConfig } from "astro/config";

/**
 * Deploy settings
 * - Production: www.capitoken.org at domain root (base = "")
 *
 * NOTE: Production repo should always build for root.
 * Staging settings live only in the staging repo.
 */
export default defineConfig({
  site: "https://www.capitoken.org",
  base: "",
  trailingSlash: "always",
});