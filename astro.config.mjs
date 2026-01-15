import { defineConfig } from "astro/config";

export default defineConfig(({ command }) => ({
  site: "https://capitoken-org.github.io",
  // En GitHub Pages el repo vive en /capitoken-site/
  // En dev (Codespaces) debe vivir en /
  base: command === "build" ? "/capitoken-site/" : "/",
}));
