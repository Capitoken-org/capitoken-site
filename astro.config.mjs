import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  site: "https://capitoken-org.github.io",
  // En GitHub Pages el repo se publica en /capitoken-site/
  // En dev (Codespaces) debe ser "/" para que no de 404.
  base: command === "build" ? "/capitoken-site/" : "/",

  vite: {
    plugins: [tailwindcss()],
  },
}));
