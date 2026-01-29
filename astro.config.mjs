import { defineConfig } from "astro/config";

/**
 * Env-driven deploy settings
 * - Production (default): www.capitoken.org at domain root (base = "")
 * - Staging (GitHub Pages): /capitoken-site-staging/ (base = "/capitoken-site-staging/")
 */
const DEPLOY_ENV = process.env.DEPLOY_ENV || "production";

const BASE_PATH =
  process.env.BASE_PATH ||
  (DEPLOY_ENV === "staging" ? "/capitoken-site-staging/" : "");

const SITE_URL =
  process.env.SITE_URL ||
  (DEPLOY_ENV === "staging"
    ? "https://capitoken-org.github.io"
    : "https://www.capitoken.org");

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: "always",
});
