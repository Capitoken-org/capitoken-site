import { defineConfig } from "astro/config";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  site: "https://capitoken-org.github.io",
  base: isProd ? "/capitoken-site" : "/",
});
