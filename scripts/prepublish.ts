import { $ } from "bun";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

await $`bun run build`;

await $`mkdir -p dist`;

await $`cp -rf packages/* dist/`;

const packageEntries = await readdir("dist", { withFileTypes: true });

const packageJsonSchema = z.object({
  name: z.string(),
  version: z.string(),
  private: z.boolean(),
  main: z.string().optional(),
  module: z.string().optional(),
  types: z.string().optional(),
  exports: z.record(z.string(), z.string()).optional(),
});

for (const packageEntry of packageEntries) {
  if (packageEntry.isDirectory()) {
    const packageDir = path.join("dist", packageEntry.name);
    const packageJson = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf-8"));
    
    
  }
}

