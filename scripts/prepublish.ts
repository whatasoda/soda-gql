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
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
  bundledDependencies: z.array(z.string()).optional(),
});

for (const packageEntry of packageEntries) {
  if (packageEntry.isDirectory()) {
    const packageDir = path.join("dist", packageEntry.name);
    const parsed = packageJsonSchema.safeParse(JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf-8")));
    if (!parsed.success) {
      console.error(`Invalid package.json: ${packageEntry.name}`);
      console.error(parsed.error);
      process.exit(1);
    }

    if (parsed.data.private) {
      console.log(`Removing private package from dist: ${packageEntry.name}`);
      await $`rm -rf ${packageDir}`;
      continue;
    }

    const packageJsonTransformed = (() => {
      const { name, version, private: private_, main, module, types, exports, dependencies, ...rest } = parsed.data;

      
      
    });
    
    
    const packageJsonDist = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf-8"));
  }
}

