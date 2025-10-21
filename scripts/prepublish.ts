import { $ } from "bun";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { version as rootVersion } from "../package.json" assert { type: "json" };

type ArgEntries<T extends object> = { [K in keyof T]-?: [value: T[K], key: K] }[keyof T];
type Entries<T extends object> = { [K in keyof T]: [key: K, value: T[K]] }[keyof T];

export const mapValues = <TObject extends object, TMappedValue>(
  obj: TObject,
  fn: (...args: ArgEntries<TObject>) => TMappedValue,
): { [K in keyof TObject]: TMappedValue } =>
  Object.fromEntries((Object.entries(obj) as Entries<TObject>[]).map(([key, value]) => [key, fn(value, key)])) as {
    [K in keyof TObject]: TMappedValue;
  };

await $`rm -rf dist`;

await $`bun run build`;

await $`mkdir -p dist`;

await $`cp -rf packages/* dist/`;

const packageDirEntries = await readdir("dist", { withFileTypes: true });

type PackageJson = z.output<typeof packageJsonSchema>;
const packageJsonSchema = z.object({
  name: z.string().regex(/^@soda-gql\//),
  version: z.string(),
  description: z.string().optional(),
  private: z.boolean(),
  license: z.literal("MIT"),
  files: z.array(z.string()),
  author: z.object({
    name: z.literal("Shota Hatada"),
    email: z.literal("shota.hatada@whatasoda.me"),
    url: z.literal("https://github.com/whatasoda"),
  }),
  bin: z.record(z.string(), z.string()).optional(),
  main: z.string(),
  module: z.string(),
  types: z.string(),
  exports: z.record(z.string(), z.unknown()),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
  bundledDependencies: z.array(z.string()).optional(),
});

type PackageEntry = {
  name: string;
  packageSourceDir: string;
  packageDistDir: string;
  packageJsonSource: PackageJson;
  packageJsonDist: PackageJson;
  workspacePackages: Set<string>;
}

const packageEntries = new Map<string, PackageEntry>();

// Read package.json files from dist directory and create package entries
for (const packageEntry of packageDirEntries) {
  if (packageEntry.isDirectory()) {
    const packageSourceDir = path.join("packages", packageEntry.name);
    const packageDistDir = path.join("dist", packageEntry.name);

    const parsedPackageJsonSource = packageJsonSchema.safeParse(JSON.parse(await readFile(path.join(packageSourceDir, "package.json"), "utf-8")));
    if (!parsedPackageJsonSource.success) {
      console.error(`Invalid package.json: ${packageEntry.name}`);
      console.error(parsedPackageJsonSource.error);
      process.exit(1);
    }
    
    const packageJsonSource = parsedPackageJsonSource.data;

    if (packageJsonSource.private) {
      console.log(`Removing private package from dist: ${packageEntry.name}`);
      await $`rm -rf ${packageDistDir}`;
      continue;
    }

    const {packageJsonDist, workspacePackages} = ((): { packageJsonDist: PackageJson; workspacePackages: Set<string> } => {
      const { name, main, private: _private, version: _version, module, types, exports, dependencies, devDependencies, peerDependencies, ...rest } = packageJsonSource;

      const workspacePackages = new Set(
        [...Object.keys(dependencies ?? {}), ...Object.keys(devDependencies ?? {}), ...Object.keys(peerDependencies ?? {})].filter((key) => key !== name && key.startsWith("@soda-gql/")),
      );
      
      const packageJsonDist: PackageJson = {
        name,
        version: rootVersion,
        private: false,
        main,
        module,
        types,
        exports,
        dependencies: mapValues(dependencies ?? {}, (value) => value === "workspace:*" ? rootVersion : value),
        devDependencies: mapValues(devDependencies ?? {}, (value) => value === "workspace:*" ? rootVersion : value),
        peerDependencies: mapValues(peerDependencies ?? {}, (value) => value === "workspace:*" ? rootVersion : value),
        ...rest,
      }

      return { packageJsonDist, workspacePackages };
    })();

    await writeFile(path.join(packageDistDir, "package.json"), JSON.stringify(packageJsonDist, null, 2));

    packageEntries.set(packageJsonSource.name, {
      name: packageJsonSource.name,
      packageSourceDir,
      packageDistDir,
      packageJsonSource,
      packageJsonDist,
      workspacePackages,
    });
  }
}

// Validate that all workspace packages are present and not private
let hasMissingWorkspacePackages = false;
for (const packageEntry of packageEntries.values()) {
  for (const workspacePackage of packageEntry.workspacePackages) {
    if (!packageEntries.has(workspacePackage)) {
      console.error(`Workspace package error: "${packageEntry.name}" tries to import "${workspacePackage}" but it does not exist or still private.`);
      hasMissingWorkspacePackages = true;
    }
  }
}
if (hasMissingWorkspacePackages) {
  process.exit(1);
}

