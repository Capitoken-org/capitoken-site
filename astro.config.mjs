import { defineConfig } from "astro/config";
import path from "node:path";

export default defineConfig(({ command }) => ({
  site: "https://capitoken-org.github.io",
  // En DEV (Codespaces) debe ser "/" para que NO pida /capitoken-site y te dé 404.
  // En BUILD (GitHub Pages) sí debe ser "/capitoken-site".
  base: command === "build" ? "/capitoken-site" : "/",

  vite: {
    resolve: {
      alias: {
        "@": path.resolve("./src"),
      },
    },
  },
}));
