import { $ } from "bun";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

await $`bun run build`;

await $`mkdir -p dist`;

await $`cp -rf packages/* dist/`;

const packageEntries = await readdir("dist", { withFileTypes: true });

for (const packageEntry of packageEntries) {
  if (packageEntry.isDirectory()) {
    const packageDir = path.join("dist", packageEntry.name);
    const packageJson = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf-8"));
    
  }
}

