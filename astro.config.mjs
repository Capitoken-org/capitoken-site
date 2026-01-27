import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.capitoken.org",
  // NOTE: no trailing slash, Astro will handle it.
  base: "/capitoken-site-staging",
  trailingSlash: "always",
});
