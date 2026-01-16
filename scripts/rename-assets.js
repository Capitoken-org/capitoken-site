import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const from = path.join(dist, "astro");
const to = path.join(dist, "_astro");

// If dist doesn't exist, nothing to do
if (!fs.existsSync(dist)) {
  console.log("dist/ does not exist. Run build first.");
  process.exit(0);
}

// Remove previous _astro if present
if (fs.existsSync(to)) {
  fs.rmSync(to, { recursive: true, force: true });
}

// Rename astro -> _astro
if (fs.existsSync(from)) {
  fs.renameSync(from, to);
  console.log("Renamed dist/astro -> dist/_astro");
} else {
  console.log("No dist/astro folder found. Nothing to rename.");
}
