import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
copyFileSync("./manifest.json", "dist/manifest.json");
console.log("✅ Copied manifest to dist/");
