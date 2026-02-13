import { copyFileSync, mkdirSync, cpSync } from "node:fs";

mkdirSync("dist", { recursive: true });
copyFileSync("./manifest.json", "dist/manifest.json");
console.log("✅ Copied manifest to dist/");

cpSync("./icons", "dist/icons", { recursive: true });
console.log("✅ Copied icons folder to dist/");