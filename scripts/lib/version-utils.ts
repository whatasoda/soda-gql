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

    // Add platform-specific packages for swc
    try {
      const platformDirs = await readdir("packages/swc/npm", { withFileTypes: true });
      for (const entry of platformDirs) {
        if (entry.isDirectory()) {
          paths.push(path.join("packages/swc/npm", entry.name, "package.json"));
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
  // For packages/swc/npm/xxx/package.json -> swc-xxx
  const parts = packagePath.split("/");
  if (parts.length === 3 && parts[1]) {
    return parts[1];
  }
  if (parts.length === 5 && parts[2] === "npm" && parts[3]) {
    return `swc-${parts[3]}`;
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

export type BumpType = "major" | "minor" | "patch";

/**
 * Compute all packages that need to be bumped
 *
 * Always bumps all packages in the workspace to keep versions in sync.
 */
export const computePackagesToBump = (graph: DependencyGraph): Set<string> => {
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
