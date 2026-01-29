import { defineConfig } from "astro/config";

/**
 * Env-driven deploy settings
 * - Production (default): www.capitoken.org at domain root (base = "")
 * - Staging (GitHub Pages): /capitoken-site-staging/ (base = "/capitoken-site-staging/")
 *
 * Set in GitHub Actions:
 *   DEPLOY_ENV=staging
 *   BASE_PATH=/capitoken-site-staging/
 *   SITE_URL=https://capitoken-org.github.io
 */
const DEPLOY_ENV = process.env.DEPLOY_ENV || "production";
const BASE_PATH =
  process.env.BASE_PATH || (DEPLOY_ENV === "staging" ? "/capitoken-site-staging/" : "");
const SITE_URL =
  process.env.SITE_URL ||
  (DEPLOY_ENV === "staging" ? "https://capitoken-org.github.io" : "https://www.capitoken.org");

export default defineConfig({
  site: "https://www.capitoken.org",
  trailingSlash: "always",
});
