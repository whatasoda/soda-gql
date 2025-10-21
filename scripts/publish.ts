import { $ } from "bun";
import { readdir } from "node:fs/promises";
import path from "node:path";

for (const packageEntry of await readdir("dist", { withFileTypes: true })) {
  if (!packageEntry.isDirectory()) {
    continue;
  }

  const packageDir = path.join("dist", packageEntry.name);

  await $`npm publish --access public ${process.argv.slice(2)}`.cwd(packageDir);
}
