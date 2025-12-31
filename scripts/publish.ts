import { $ } from "bun";
import { readdir } from "node:fs/promises";
import path from "node:path";

type PackageJson = {
  name: string;
  version: string;
};

/**
 * Check if a package version already exists on npm registry
 */
const isVersionPublished = async (name: string, version: string): Promise<boolean> => {
  const result = await $`npm view ${name}@${version} version`.quiet().nothrow();
  return result.exitCode === 0;
};

const publishAll = async ({ extraArgs }: { extraArgs: string[] }) => {
  const isDryRun = extraArgs.includes("--dry-run");

  for (const packageEntry of await readdir("dist", { withFileTypes: true })) {
    if (!packageEntry.isDirectory()) {
      continue;
    }

    const packageDir = path.join("dist", packageEntry.name);
    const packageJson: PackageJson = await Bun.file(path.join(packageDir, "package.json")).json();

    // Skip if already published (except in dry-run mode)
    if (!isDryRun) {
      const published = await isVersionPublished(packageJson.name, packageJson.version);
      if (published) {
        console.log(`Skipping ${packageJson.name}@${packageJson.version} (already published)`);
        continue;
      }
    }

    console.log(`Publishing ${packageJson.name}@${packageJson.version}...`);
    await $`npm publish --access public ${extraArgs}`.cwd(packageDir);
  }
};

const main = async () => {
  await $`bun prepublish`;

  const extraArgs = process.argv.slice(2);

  if (!extraArgs.includes("--dry-run")) {
    await publishAll({ extraArgs: [...extraArgs, "--dry-run"] });
  }

  await publishAll({ extraArgs });
};

await main();
