import { $ } from "bun";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { err, ok, type Result } from "neverthrow";

export type PackageInfo = {
  name: string;
  dirName: string;
  packagePath: string;
  packageDir: string;
  version: string;
  workspaceDeps: Set<string>;
  isPrivate: boolean;
};

export type DependencyGraph = {
  packages: Map<string, PackageInfo>;
  dependsOn: Map<string, Set<string>>;
  dependedBy: Map<string, Set<string>>;
};

type PackageJson = {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
};

/**
 * Get the last release tag from git
 */
export const getLastReleaseTag = async (): Promise<Result<string | null, string>> => {
  try {
    const result = await $`git describe --tags --abbrev=0`.quiet();
    const tag = result.stdout.toString().trim();
    if (!tag) {
      return ok(null);
    }
    return ok(tag);
  } catch {
    // No tags exist yet
    return ok(null);
  }
};

/**
 * Check if a package directory has changes since the last tag
 */
export const hasChanges = async (
  packageDir: string,
  lastTag: string,
): Promise<Result<boolean, string>> => {
  try {
    const result = await $`git diff ${lastTag}..HEAD --quiet -- ${packageDir}`.quiet().nothrow();
    // Exit code 0 = no changes, 1 = has changes
    return ok(result.exitCode !== 0);
  } catch (error) {
    return err(`Failed to check changes for ${packageDir}: ${String(error)}`);
  }
};

/**
 * Get all package.json paths in the workspace
 */
export const getPackagePaths = async (): Promise<Result<string[], string>> => {
  try {
    const packageDirs = await readdir("packages", { withFileTypes: true });
    const paths = packageDirs
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join("packages", entry.name, "package.json"));

    // Add root package.json
    paths.unshift("package.json");

    // Add platform-specific packages for swc-transformer
    try {
      const platformDirs = await readdir("packages/swc-transformer/npm", { withFileTypes: true });
      for (const entry of platformDirs) {
        if (entry.isDirectory()) {
          paths.push(path.join("packages/swc-transformer/npm", entry.name, "package.json"));
        }
      }
    } catch {
      // Platform packages may not exist yet
    }

    return ok(paths);
  } catch (error) {
    return err(`Failed to read packages directory: ${String(error)}`);
  }
};

/**
 * Read and parse package.json
 */
export const readPackageJson = async (filePath: string): Promise<Result<PackageJson, string>> => {
  try {
    const content = await readFile(filePath, "utf-8");
    const packageJson = JSON.parse(content) as PackageJson;
    return ok(packageJson);
  } catch (error) {
    return err(`Failed to read ${filePath}: ${String(error)}`);
  }
};

/**
 * Extract workspace dependencies from a package.json
 */
export const extractWorkspaceDeps = (pkg: PackageJson): Set<string> => {
  const deps = new Set<string>();
  const allDeps: Record<string, string> = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
    ...pkg.optionalDependencies,
  };

  for (const [name, version] of Object.entries(allDeps)) {
    if (name.startsWith("@soda-gql/") && version === "workspace:*") {
      deps.add(name);
    }
  }
  return deps;
};

/**
 * Extract directory name from package path
 */
const extractDirName = (packagePath: string): string => {
  // For root package.json
  if (packagePath === "package.json") {
    return ".";
  }
  // For packages/xxx/package.json -> xxx
  // For packages/swc-transformer/npm/xxx/package.json -> swc-transformer-xxx
  const parts = packagePath.split("/");
  if (parts.length === 3 && parts[1]) {
    return parts[1];
  }
  if (parts.length === 5 && parts[2] === "npm" && parts[3]) {
    return `swc-transformer-${parts[3]}`;
  }
  return parts[parts.length - 2] ?? packagePath;
};

/**
 * Build the dependency graph for all workspace packages
 */
export const buildDependencyGraph = async (): Promise<Result<DependencyGraph, string>> => {
  const packages = new Map<string, PackageInfo>();
  const dependsOn = new Map<string, Set<string>>();
  const dependedBy = new Map<string, Set<string>>();

  const pathsResult = await getPackagePaths();
  if (pathsResult.isErr()) {
    return err(pathsResult.error);
  }

  for (const packagePath of pathsResult.value) {
    const pkgResult = await readPackageJson(packagePath);
    if (pkgResult.isErr()) {
      // Skip files that can't be read (e.g., platform packages that don't exist yet)
      continue;
    }

    const pkg = pkgResult.value;
    const deps = extractWorkspaceDeps(pkg);
    const dirName = extractDirName(packagePath);

    packages.set(pkg.name, {
      name: pkg.name,
      dirName,
      packagePath,
      packageDir: path.dirname(packagePath),
      version: pkg.version,
      workspaceDeps: deps,
      isPrivate: pkg.private === true,
    });

    dependsOn.set(pkg.name, deps);

    // Build reverse graph
    for (const dep of deps) {
      if (!dependedBy.has(dep)) {
        dependedBy.set(dep, new Set());
      }
      dependedBy.get(dep)!.add(pkg.name);
    }
  }

  return ok({ packages, dependsOn, dependedBy });
};

/**
 * Detect packages with direct changes since the last tag
 */
export const detectDirectChanges = async (
  graph: DependencyGraph,
  lastTag: string | null,
): Promise<Result<Set<string>, string>> => {
  const changed = new Set<string>();

  // If no tag exists, all packages are considered changed
  if (lastTag === null) {
    for (const name of graph.packages.keys()) {
      changed.add(name);
    }
    return ok(changed);
  }

  for (const [name, info] of graph.packages) {
    // Skip root package (always bumped)
    if (info.packageDir === ".") {
      changed.add(name);
      continue;
    }

    const hasChangesResult = await hasChanges(info.packageDir, lastTag);
    if (hasChangesResult.isErr()) {
      return err(hasChangesResult.error);
    }

    if (hasChangesResult.value) {
      changed.add(name);
    }
  }

  return ok(changed);
};

export type BumpType = "major" | "minor" | "patch";

/**
 * Compute all packages that need to be bumped
 *
 * For patch bumps: Only bump directly changed packages
 * For minor/major bumps: Bump all packages in the workspace
 */
export const computePackagesToBump = (
  directlyChanged: Set<string>,
  graph: DependencyGraph,
  bumpType: BumpType,
): Set<string> => {
  // For patch bumps, only bump directly changed packages
  if (bumpType === "patch") {
    return new Set(directlyChanged);
  }

  // For minor/major bumps, bump all packages
  return new Set(graph.packages.keys());
};

/**
 * Get root package version
 */
export const getRootVersion = async (): Promise<Result<string, string>> => {
  const pkgResult = await readPackageJson("package.json");
  if (pkgResult.isErr()) {
    return err(pkgResult.error);
  }
  return ok(pkgResult.value.version);
};
