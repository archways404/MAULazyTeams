// scripts/build-release-ffx.js
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, "dist");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, shell: true });
}

function ensureDist() {
  fs.mkdirSync(DIST, { recursive: true });
}

function instructionsMd(target) {
  const buildScript = target === "ffx" ? "build:ffx" : "build:chrome";
  return `# MAULazyTeams — Build Instructions (${target})

## Requirements
- Node.js (LTS recommended)
- pnpm

## Build
1. Unzip \`source.zip\`
2. \`cd\` into the extracted folder
3. Install deps:
   \`\`\`bash
   pnpm install
   \`\`\`
4. Build:
   \`\`\`bash
   pnpm run ${buildScript}
   \`\`\`

## Output
- \`dist/\` contains the built extension.
- \`dist/distro.zip\` contains the distributable build (just \`dist/\` contents).
`;
}

async function zipFolderToFile({ zipPath, addFn }) {
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    addFn(archive);
    archive.finalize();
  });

  console.log(`Created: ${path.relative(ROOT, zipPath)}`);
}

async function createDistroZip() {
  const zipPath = path.join(DIST, "distro.zip");
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

  await zipFolderToFile({
    zipPath,
    addFn: (archive) => {
      // zip the CONTENTS of dist/, not dist/ itself
      archive.directory(DIST + path.sep, false, (entry) => {
        // exclude existing zips inside dist
        if (entry.name.endsWith(".zip")) return false;
        return entry;
      });
    },
  });
}

async function createSourceZipFFX() {
  const zipPath = path.join(DIST, "source.zip");
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

  await zipFolderToFile({
    zipPath,
    addFn: (archive) => {
      // Add build instructions as a virtual file inside the zip
      archive.append(instructionsMd("ffx"), { name: "instructions.md" });

      // Include repo files, exclude heavy/irrelevant
      archive.glob("**/*", {
        cwd: ROOT,
        dot: true,
        ignore: [
          "node_modules/**",
          "dist/**",
          ".git/**",
          ".github/**",
          "**/*.zip",

          // target-specific exclusion:
          "chrome-manifest.json", // firefox build shouldn't ship chrome manifest
        ],
      });
    },
  });
}

async function main() {
  ensureDist();

  // build for firefox
  run("pnpm run build:ffx");

  // zips
  await createDistroZip();
  await createSourceZipFFX();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
