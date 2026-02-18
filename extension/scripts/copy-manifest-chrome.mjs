import { copyFileSync, mkdirSync, cpSync } from "node:fs";

mkdirSync("dist", { recursive: true });
copyFileSync("./chrome-manifest.json", "dist/manifest.json");
console.log("Copied Chrome manifest to dist/");

cpSync("./icons", "dist/icons", { recursive: true });
console.log("Copied icons folder to dist/");