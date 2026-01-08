import {
  buildDependencyGraph,
  computePackagesToBump,
  detectDirectChanges,
  getLastReleaseTag,
  getRootVersion,
  type BumpType,
  type DependencyGraph,
} from "./lib/version-utils";

type CheckMode = "validate" | "list-bump" | "list-skip";

type ValidationError = {
  package: string;
  message: string;
};

/**
 * Validate that all package versions are consistent with expected bump plan
 */
const validateVersions = async (
  graph: DependencyGraph,
  toBump: Set<string>,
): Promise<ValidationError[]> => {
  const errors: ValidationError[] = [];

  const rootVersionResult = await getRootVersion();
  if (rootVersionResult.isErr()) {
    errors.push({
      package: "root",
      message: `Failed to get root version: ${rootVersionResult.error}`,
    });
    return errors;
  }
  const rootVersion = rootVersionResult.value;

  for (const [name, info] of graph.packages) {
    // Skip root package (it's always the source of truth)
    if (info.packageDir === ".") {
      continue;
    }

    // Skip private packages from validation
    if (info.isPrivate) {
      continue;
    }

    const shouldBeBumped = toBump.has(name);
    const isAtRootVersion = info.version === rootVersion;

    if (shouldBeBumped && !isAtRootVersion) {
      errors.push({
        package: name,
        message: `Should be bumped to ${rootVersion} but is ${info.version}`,
      });
    }

    if (!shouldBeBumped && isAtRootVersion) {
      // This is actually fine - package was bumped but no changes detected
      // This can happen if the bump was done manually or in a previous release
    }
  }

  return errors;
};

/**
 * Main function
 */
const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const mode = args[0] as CheckMode | undefined;
  const bumpType = (args[1] as BumpType | undefined) ?? "minor";

  if (!mode || !["validate", "list-bump", "list-skip"].includes(mode)) {
    console.error("Usage: bun scripts/version-check.ts <validate|list-bump|list-skip> [bump-type]");
    console.error("");
    console.error("Modes:");
    console.error("  validate   - Validate that all package versions match expected bump plan");
    console.error("  list-bump  - List packages that should be bumped");
    console.error("  list-skip  - List packages that should be skipped");
    console.error("");
    console.error("Bump types (optional, default: minor):");
    console.error("  patch - Only directly changed packages (no cascade)");
    console.error("  minor - Include cascade to dependents");
    console.error("  major - Include cascade to dependents");
    process.exit(1);
  }

  // Build dependency graph
  const graphResult = await buildDependencyGraph();
  if (graphResult.isErr()) {
    console.error(`Error building dependency graph: ${graphResult.error}`);
    process.exit(1);
  }
  const graph = graphResult.value;

  // Get last release tag
  const tagResult = await getLastReleaseTag();
  if (tagResult.isErr()) {
    console.error(`Error getting last tag: ${tagResult.error}`);
    process.exit(1);
  }
  const lastTag = tagResult.value;

  // Detect direct changes
  const directChangesResult = await detectDirectChanges(graph, lastTag);
  if (directChangesResult.isErr()) {
    console.error(`Error detecting changes: ${directChangesResult.error}`);
    process.exit(1);
  }
  const directChanges = directChangesResult.value;

  // Compute all packages to bump
  const toBump = computePackagesToBump(graph);

  // Compute packages to skip
  const toSkip = new Set<string>();
  for (const name of graph.packages.keys()) {
    if (!toBump.has(name)) {
      toSkip.add(name);
    }
  }

  switch (mode) {
    case "validate": {
      console.log(`Last release tag: ${lastTag ?? "(none)"}`);
      console.log(`Packages to bump: ${toBump.size}`);
      console.log(`Packages to skip: ${toSkip.size}`);
      console.log("");

      const errors = await validateVersions(graph, toBump);

      if (errors.length > 0) {
        console.error("Validation errors:");
        for (const error of errors) {
          console.error(`  - ${error.package}: ${error.message}`);
        }
        process.exit(1);
      }

      console.log("All package versions are valid");
      break;
    }

    case "list-bump": {
      for (const name of toBump) {
        const info = graph.packages.get(name);
        if (info && !info.isPrivate) {
          console.log(name);
        }
      }
      break;
    }

    case "list-skip": {
      for (const name of toSkip) {
        const info = graph.packages.get(name);
        if (info && !info.isPrivate) {
          console.log(name);
        }
      }
      break;
    }
  }
};

await main();
