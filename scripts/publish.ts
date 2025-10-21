import { $ } from "bun";
import { readdir } from "node:fs/promises";
import path from "node:path";

const publishAll = async ({ extraArgs }: { extraArgs: string[] }) => {
  for (const packageEntry of await readdir("dist", { withFileTypes: true })) {
    if (!packageEntry.isDirectory()) {
      continue;
    }
  
    const packageDir = path.join("dist", packageEntry.name);
  
    await $`npm publish --access public ${extraArgs}`.cwd(packageDir);
  }
}

const main = async () => {
  $`bun prepublish`;

  const extraArgs = process.argv.slice(2);

  if (!extraArgs.includes("--dry-run")) {
    await publishAll({ extraArgs: [...extraArgs, "--dry-run"] });
  }

  await publishAll({ extraArgs });
}

await main();
