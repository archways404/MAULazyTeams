// scripts/build-release-chrome.js
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
      archive.directory(DIST + path.sep, false, (entry) => {
        if (entry.name.endsWith(".zip")) return false;
        return entry;
      });
    },
  });
}

async function createSourceZipChrome() {
  const zipPath = path.join(DIST, "source.zip");
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath);

  await zipFolderToFile({
    zipPath,
    addFn: (archive) => {
      archive.append(instructionsMd("chrome"), { name: "instructions.md" });

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
          "manifest.json", // chrome build shouldn't ship firefox manifest (if you keep both)
        ],
      });
    },
  });
}

async function main() {
  ensureDist();

  // build for chrome
  run("pnpm run build:chrome");

  // zips
  await createDistroZip();
  await createSourceZipChrome();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
