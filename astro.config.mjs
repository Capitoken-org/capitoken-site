import { defineConfig } from "astro/config";

export default defineConfig(({ command }) => ({
  site: "https://capitoken-org.github.io",
  base: command === "build" ? "/capitoken-site/" : "/",
  trailingSlash: "always",
  build: {
    assets: "_astro",
  },
}));
