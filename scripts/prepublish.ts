import type { Dirent } from "node:fs";
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
  peerDependenciesMeta: z.record(z.string(), z.object({ optional: z.boolean().optional() }).passthrough()).optional(),
});

// Schema for private packages (minimal validation, not published to npm)
const privatePackageJsonSchema = z.object({
  name: z.string().regex(/^@soda-gql\//),
  private: z.literal(true),
});

// Whitelist of non-scoped public packages with separate packaging (e.g., VSCode extensions)
const NON_SCOPED_PUBLIC_PACKAGES = new Set(["soda-gql-vscode-extension"]);

// Schema for non-scoped public packages (lighter validation — these have separate packaging pipelines)
const nonScopedPublicPackageJsonSchema = z.object({
  name: z.string().refine((n) => NON_SCOPED_PUBLIC_PACKAGES.has(n)),
  version: z.string(),
  description: z.string().min(1),
  private: z.literal(false),
  license: z.literal("MIT"),
  author: z.object({
    name: z.literal("Shota Hatada"),
    email: z.literal("shota.hatada@whatasoda.me"),
    url: z.literal("https://github.com/whatasoda"),
  }),
  repository: z.object({
    type: z.literal("git"),
    url: z.literal("https://github.com/whatasoda/soda-gql.git"),
    directory: z.string().regex(/^packages\//),
  }),
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

  await $`rsync -a --exclude='node_modules' --exclude='target' --exclude='.cache' --exclude='.cargo' packages/ dist/`;

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

        // Check if this is a non-scoped public package (e.g., VSCode extension with separate packaging)
        const parsedNonScoped = nonScopedPublicPackageJsonSchema.safeParse(rawPackageJson);
        if (parsedNonScoped.success) {
          console.log(`Removing non-scoped public package from npm dist (separate packaging): ${packageEntry.name}`);
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
            peerDependenciesMeta,
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
            peerDependenciesMeta,
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

  let platformDirEntries: Dirent[];
  try {
    platformDirEntries = await readdir(platformPackagesDir, { withFileTypes: true });
  } catch {
    console.log("No platform packages directory found (expected for local builds).");
    return;
  }

  const dirs = platformDirEntries.filter((entry) => entry.isDirectory());
  if (dirs.length === 0) {
    console.log("No platform packages found (expected for local builds).");
    return;
  }

  // Read swc's version to use for platform packages
  const swcTransformerPackageJson = JSON.parse(await readFile("packages/swc/package.json", "utf-8"));
  const swcTransformerVersion = swcTransformerPackageJson.version as string;

  let hasErrors = false;
  for (const entry of dirs) {
    const sourceDir = path.join(platformPackagesDir, entry.name);
    const distDir = path.join("dist", `swc-${entry.name}`);

    // Copy the platform package directory
    await $`cp -rf ${sourceDir} ${distDir}`;

    // Read and update package.json with swc's version
    const packageJsonPath = path.join(distDir, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));

    const parsed = platformPackageJsonSchema.safeParse(packageJson);
    if (!parsed.success) {
      console.error(`Platform package validation failed for swc-${entry.name}:`);
      console.error(parsed.error.format());
      hasErrors = true;
      continue;
    }

    // Update version to match swc's version
    packageJson.version = swcTransformerVersion;
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log(`Prepared platform package: ${packageJson.name}`);
  }

  if (hasErrors) {
    process.exit(1);
  }
};

/**
 * Add optionalDependencies to swc dist package.json
 * This dynamically generates optionalDependencies based on platform packages found
 */
const addOptionalDependenciesToSwcTransformer = async () => {
  const platformPackagesDir = "packages/swc/npm";
  const swcTransformerDistPath = "dist/swc/package.json";

  // Check prerequisites — non-fatal if missing (expected for local builds)
  let distSwcPkgRaw: string;
  try {
    distSwcPkgRaw = await readFile(swcTransformerDistPath, "utf-8");
  } catch {
    console.log("dist/swc/package.json not found — skipping optionalDependencies injection.");
    return;
  }

  let platformDirEntries: Dirent[];
  try {
    platformDirEntries = await readdir(platformPackagesDir, { withFileTypes: true });
  } catch {
    console.log("No platform packages directory — skipping optionalDependencies injection.");
    return;
  }

  const dirs = platformDirEntries.filter((entry) => entry.isDirectory());
  if (dirs.length === 0) {
    console.log("No platform packages found — skipping optionalDependencies injection.");
    return;
  }

  // From here: platform packages exist, errors are fatal
  const swcTransformerSourceJson = JSON.parse(await readFile("packages/swc/package.json", "utf-8"));
  const exactVersion = swcTransformerSourceJson.version as string;

  const optionalDependencies: Record<string, string> = {};
  for (const entry of dirs) {
    optionalDependencies[`@soda-gql/swc-${entry.name}`] = exactVersion;
  }

  const packageJson = JSON.parse(distSwcPkgRaw);
  packageJson.optionalDependencies = optionalDependencies;
  await writeFile(swcTransformerDistPath, JSON.stringify(packageJson, null, 2));

  console.log(`Added optionalDependencies to swc: ${Object.keys(optionalDependencies).join(", ")}`);
};

const validateWorkspaceResiduals = async (packageEntries: Map<string, PackageEntry>) => {
  const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
  let hasResiduals = false;
  for (const entry of packageEntries.values()) {
    const distPkgPath = path.join(entry.packageDistDir, "package.json");
    const distPkg = JSON.parse(await readFile(distPkgPath, "utf-8"));
    for (const field of DEP_FIELDS) {
      const deps: Record<string, string> | undefined = distPkg[field];
      if (!deps) continue;
      for (const [dep, version] of Object.entries(deps)) {
        if (version.startsWith("workspace:")) {
          console.error(`Workspace protocol residual: "${entry.name}" has "${dep}": "${version}" in ${field}`);
          hasResiduals = true;
        }
      }
    }
  }
  if (hasResiduals) {
    process.exit(1);
  }
};

const main = async () => {
  const packageEntries = await prepare();
  await validate(packageEntries);
  await preparePlatformPackages();
  await addOptionalDependenciesToSwcTransformer();
  await validateWorkspaceResiduals(packageEntries);
};

await main();
