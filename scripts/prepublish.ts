import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { $ } from "bun";
import { z } from "zod";

type ArgEntries<T extends object> = { [K in keyof T]-?: [value: T[K], key: K] }[keyof T];
type Entries<T extends object> = { [K in keyof T]: [key: K, value: T[K]] }[keyof T];

export const mapValues = <TObject extends object, TMappedValue>(
  obj: TObject,
  fn: (...args: ArgEntries<TObject>) => TMappedValue,
): { [K in keyof TObject]: TMappedValue } =>
  Object.fromEntries((Object.entries(obj) as Entries<TObject>[]).map(([key, value]) => [key, fn(value, key)])) as {
    [K in keyof TObject]: TMappedValue;
  };

// Schema for public packages (strict validation for npm registry)
type PackageJson = z.output<typeof packageJsonSchema>;
const packageJsonSchema = z.object({
  name: z.string().regex(/^@soda-gql\//),
  type: z.enum(["module", "commonjs"]),
  version: z.string(),
  description: z.string().min(1),
  private: z.boolean(),
  license: z.literal("MIT"),
  files: z.array(z.string()),
  author: z.object({
    name: z.literal("Shota Hatada"),
    email: z.literal("shota.hatada@whatasoda.me"),
    url: z.literal("https://github.com/whatasoda"),
  }),
  keywords: z.array(z.string()).min(1),
  repository: z.object({
    type: z.literal("git"),
    url: z.literal("https://github.com/whatasoda/soda-gql.git"),
    directory: z.string().regex(/^packages\//),
  }),
  homepage: z.literal("https://github.com/whatasoda/soda-gql#readme"),
  bugs: z.object({
    url: z.literal("https://github.com/whatasoda/soda-gql/issues"),
  }),
  engines: z.object({
    node: z.literal(">=18"),
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

// Schema for private packages (minimal validation, not published to npm)
const privatePackageJsonSchema = z.object({
  name: z.string().regex(/^@soda-gql\//),
  private: z.literal(true),
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

  await $`bun run build:release`;

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

        const rawPackageJson = JSON.parse(await readFile(path.join(packageSourceDir, "package.json"), "utf-8"));

        // Check if this is a private package first
        const parsedPrivate = privatePackageJsonSchema.safeParse(rawPackageJson);
        if (parsedPrivate.success) {
          console.log(`Removing private package from dist: ${packageEntry.name}`);
          await $`rm -rf ${packageDistDir}`;
          continue;
        }

        // Validate public package with strict schema
        const parsedPackageJsonSource = packageJsonSchema.safeParse(rawPackageJson);
        if (!parsedPackageJsonSource.success) {
          console.error(`Invalid package.json: ${packageEntry.name}`);
          console.error(parsedPackageJsonSource.error);
          hasErrors = true;
          continue;
        }

        const packageJsonSource = parsedPackageJsonSource.data;

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
            keywords,
            repository,
            homepage,
            bugs,
            engines,
            main,
            module,
            types,
            exports,
            dependencies,
            devDependencies,
            peerDependencies,
            optionalDependencies,
            ...rest
          } = packageJsonSource;

          const workspacePackages = new Set(
            [
              ...Object.keys(dependencies ?? {}),
              ...Object.keys(devDependencies ?? {}),
              ...Object.keys(peerDependencies ?? {}),
              ...Object.keys(optionalDependencies ?? {}),
            ].filter((key) => key !== name && key.startsWith("@soda-gql/")),
          );

          const exactVersion = packageJsonSource.version;

          const packageJsonDist: PackageJson = {
            name,
            version: packageJsonSource.version,
            description,
            type,
            private: false,
            license,
            files,
            bin,
            author,
            keywords,
            repository,
            homepage,
            bugs,
            engines,
            main,
            module,
            types,
            exports,
            dependencies: mapValues(dependencies ?? {}, (value) => (value === "workspace:*" ? exactVersion : value)),
            devDependencies: mapValues(devDependencies ?? {}, (value) => (value === "workspace:*" ? exactVersion : value)),
            peerDependencies: mapValues(peerDependencies ?? {}, (value) => (value === "workspace:*" ? exactVersion : value)),
            optionalDependencies: mapValues(optionalDependencies ?? {}, (value) =>
              value === "workspace:*" ? exactVersion : value,
            ),
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

// Platform package schema (simpler than main packages)
const platformPackageJsonSchema = z.object({
  name: z.string().regex(/^@soda-gql\/swc-/),
  version: z.string(),
  os: z.array(z.string()),
  cpu: z.array(z.string()),
  main: z.string(),
  files: z.array(z.string()),
  license: z.literal("MIT"),
  libc: z.array(z.string()).optional(),
  author: z.object({
    name: z.literal("Shota Hatada"),
    email: z.literal("shota.hatada@whatasoda.me"),
    url: z.literal("https://github.com/whatasoda"),
  }),
  repository: z
    .object({
      type: z.literal("git"),
      url: z.string(),
      directory: z.string(),
    })
    .optional(),
});

const preparePlatformPackages = async () => {
  const platformPackagesDir = "packages/swc/npm";
  const platformDistDir = "dist";

  // Read swc's version to use for platform packages
  const swcTransformerPackageJson = JSON.parse(await readFile("packages/swc/package.json", "utf-8"));
  const swcTransformerVersion = swcTransformerPackageJson.version as string;

  try {
    const platformDirEntries = await readdir(platformPackagesDir, { withFileTypes: true });

    for (const entry of platformDirEntries) {
      if (!entry.isDirectory()) continue;

      const sourceDir = path.join(platformPackagesDir, entry.name);
      const distDir = path.join(platformDistDir, `swc-${entry.name}`);

      // Copy the platform package directory
      await $`cp -rf ${sourceDir} ${distDir}`;

      // Read and update package.json with swc's version
      const packageJsonPath = path.join(distDir, "package.json");
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));

      const parsed = platformPackageJsonSchema.safeParse(packageJson);
      if (!parsed.success) {
        console.error(`Invalid platform package.json: ${entry.name}`);
        console.error(parsed.error);
        continue;
      }

      // Update version to match swc's version
      packageJson.version = swcTransformerVersion;
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      console.log(`Prepared platform package: ${packageJson.name}`);
    }
  } catch (error) {
    // Platform packages may not exist yet (e.g., first build)
    console.log("No platform packages found (this is expected for local builds)", error);
  }
};

/**
 * Add optionalDependencies to swc dist package.json
 * This dynamically generates optionalDependencies based on platform packages found
 */
const addOptionalDependenciesToSwcTransformer = async () => {
  const platformPackagesDir = "packages/swc/npm";
  const swcTransformerDistPath = "dist/swc/package.json";

  // Read swc's version for platform package dependencies
  const swcTransformerSourceJson = JSON.parse(await readFile("packages/swc/package.json", "utf-8"));
  const exactVersion = swcTransformerSourceJson.version as string;

  try {
    const platformDirEntries = await readdir(platformPackagesDir, { withFileTypes: true });
    const optionalDependencies: Record<string, string> = {};

    for (const entry of platformDirEntries) {
      if (entry.isDirectory()) {
        const packageName = `@soda-gql/swc-${entry.name}`;
        optionalDependencies[packageName] = exactVersion;
      }
    }

    if (Object.keys(optionalDependencies).length === 0) {
      console.log("No platform packages found, skipping optionalDependencies injection");
      return;
    }

    const packageJson = JSON.parse(await readFile(swcTransformerDistPath, "utf-8"));
    packageJson.optionalDependencies = optionalDependencies;
    await writeFile(swcTransformerDistPath, JSON.stringify(packageJson, null, 2));

    console.log(`Added optionalDependencies to swc: ${Object.keys(optionalDependencies).join(", ")}`);
  } catch (error) {
    // Platform packages may not exist yet (e.g., first build)
    console.log("Could not add optionalDependencies to swc (this is expected for local builds)", error);
  }
};

const main = async () => {
  const packageEntries = await prepare();
  await validate(packageEntries);
  await preparePlatformPackages();
  await addOptionalDependenciesToSwcTransformer();
};

await main();
