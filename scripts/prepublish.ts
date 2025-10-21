import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { $ } from "bun";
import { z } from "zod";
import { version as rootVersion } from "../package.json" with { type: "json" };

type ArgEntries<T extends object> = { [K in keyof T]-?: [value: T[K], key: K] }[keyof T];
type Entries<T extends object> = { [K in keyof T]: [key: K, value: T[K]] }[keyof T];

export const mapValues = <TObject extends object, TMappedValue>(
  obj: TObject,
  fn: (...args: ArgEntries<TObject>) => TMappedValue,
): { [K in keyof TObject]: TMappedValue } =>
  Object.fromEntries((Object.entries(obj) as Entries<TObject>[]).map(([key, value]) => [key, fn(value, key)])) as {
    [K in keyof TObject]: TMappedValue;
  };

type PackageJson = z.output<typeof packageJsonSchema>;
const packageJsonSchema = z.object({
  name: z.string().regex(/^@soda-gql\//),
  type: z.enum(["module", "commonjs"]),
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
};

const prepare = async () => {
  await $`rm -rf dist`;

  await $`bun run build`;

  await $`mkdir -p dist`;

  await $`cp -rf packages/* dist/`;

  const packageDirEntries = await readdir("dist", { withFileTypes: true });

  const packageEntries = new Map<string, PackageEntry>();

  let hasErrors = false;
  // Read package.json files from dist directory and create package entries
  for (const packageEntry of packageDirEntries) {
    try {
      if (packageEntry.isDirectory()) {
        const packageSourceDir = path.join("packages", packageEntry.name);
        const packageDistDir = path.join("dist", packageEntry.name);

        const parsedPackageJsonSource = packageJsonSchema.safeParse(
          JSON.parse(await readFile(path.join(packageSourceDir, "package.json"), "utf-8")),
        );
        if (!parsedPackageJsonSource.success) {
          console.error(`Invalid package.json: ${packageEntry.name}`);
          console.error(parsedPackageJsonSource.error);
          hasErrors = true;
          continue;
        }

        const packageJsonSource = parsedPackageJsonSource.data;

        if (packageJsonSource.private) {
          console.log(`Removing private package from dist: ${packageEntry.name}`);
          await $`rm -rf ${packageDistDir}`;
          continue;
        }

        const { packageJsonDist, workspacePackages } = ((): { packageJsonDist: PackageJson; workspacePackages: Set<string> } => {
          const {
            name,
            version: _version,
            description,
            type,
            private: _private,
            license,
            files,
            bin,
            author,
            main,
            module,
            types,
            exports,
            dependencies,
            devDependencies,
            peerDependencies,
            ...rest
          } = packageJsonSource;

          const workspacePackages = new Set(
            [
              ...Object.keys(dependencies ?? {}),
              ...Object.keys(devDependencies ?? {}),
              ...Object.keys(peerDependencies ?? {}),
            ].filter((key) => key !== name && key.startsWith("@soda-gql/")),
          );

          const packageJsonDist: PackageJson = {
            name,
            version: rootVersion,
            description,
            type,
            private: false,
            license,
            files,
            bin,
            author,
            main,
            module,
            types,
            exports,
            dependencies: mapValues(dependencies ?? {}, (value) => (value === "workspace:*" ? rootVersion : value)),
            devDependencies: mapValues(devDependencies ?? {}, (value) => (value === "workspace:*" ? rootVersion : value)),
            peerDependencies: mapValues(peerDependencies ?? {}, (value) => (value === "workspace:*" ? rootVersion : value)),
            ...rest,
          };

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
    } catch (error) {
      console.error(`Error processing package ${packageEntry.name}: ${error instanceof Error ? error.message : String(error)}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  return packageEntries;
};

const validate = async (packageEntries: Map<string, PackageEntry>) => {
  // Validate that all workspace packages are present and not private
  let hasMissingWorkspacePackages = false;
  for (const packageEntry of packageEntries.values()) {
    for (const workspacePackage of packageEntry.workspacePackages) {
      if (!packageEntries.has(workspacePackage)) {
        console.error(
          `Workspace package error: "${packageEntry.name}" tries to import "${workspacePackage}" but it does not exist or still private.`,
        );
        hasMissingWorkspacePackages = true;
      }
    }
  }
  if (hasMissingWorkspacePackages) {
    process.exit(1);
  }
};

const main = async () => {
  const packageEntries = await prepare();
  await validate(packageEntries);
};

await main();
