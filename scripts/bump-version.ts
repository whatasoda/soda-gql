import { $ } from "bun";
import { readFile, writeFile } from "node:fs/promises";
import { err, ok, type Result } from "neverthrow";
import {
  buildDependencyGraph,
  computePackagesToBump,
  detectDirectChanges,
  getLastReleaseTag,
  getPackagePaths,
  type DependencyGraph,
  type PackageInfo,
} from "./lib/version-utils";

type BumpType = "major" | "minor" | "patch";

type PackageJson = {
  name: string;
  version: string;
  [key: string]: unknown;
};

type BumpPlan = {
  toBump: Set<string>;
  toSkip: Set<string>;
  newVersion: string;
  directChanges: Set<string>;
  cascadeChanges: Set<string>;
  graph: DependencyGraph;
};

/**
 * Parse semantic version string
 */
const parseVersion = (version: string): Result<[number, number, number], string> => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return err(`Invalid version format: ${version}`);
  }
  const [, major, minor, patch] = match;
  return ok([Number(major), Number(minor), Number(patch)]);
};

/**
 * Increment version based on bump type
 */
const incrementVersion = (version: string, bumpType: BumpType): Result<string, string> => {
  return parseVersion(version).map(([major, minor, patch]) => {
    switch (bumpType) {
      case "major":
        return `${major + 1}.0.0`;
      case "minor":
        return `${major}.${minor + 1}.0`;
      case "patch":
        return `${major}.${minor}.${patch + 1}`;
    }
  });
};

/**
 * Read and parse package.json
 */
const readPackageJson = async (filePath: string): Promise<Result<PackageJson, string>> => {
  try {
    const content = await readFile(filePath, "utf-8");
    const packageJson = JSON.parse(content) as PackageJson;
    return ok(packageJson);
  } catch (error) {
    return err(`Failed to read ${filePath}: ${String(error)}`);
  }
};

/**
 * Write package.json with updated version
 */
const writePackageJson = async (
  filePath: string,
  packageJson: PackageJson,
): Promise<Result<void, string>> => {
  try {
    const content = JSON.stringify(packageJson, null, 2) + "\n";
    await writeFile(filePath, content, "utf-8");
    return ok(undefined);
  } catch (error) {
    return err(`Failed to write ${filePath}: ${String(error)}`);
  }
};

/**
 * Verify local build before version bump
 * Ensures swc-transformer builds and prepublish succeeds
 */
const verifyLocalBuild = async (): Promise<Result<void, string>> => {
  console.log("Verifying local build...\n");

  // 1. Build swc-transformer native module
  console.log("  Building swc-transformer...");
  const buildResult = await $`bun run build`.cwd("packages/swc-transformer").quiet().nothrow();
  if (buildResult.exitCode !== 0) {
    console.error(buildResult.stderr.toString());
    return err("swc-transformer build failed. Run 'bun run build' in packages/swc-transformer to debug.");
  }
  console.log("  ✓ swc-transformer build succeeded");

  // 2. Run prepublish
  console.log("  Running prepublish...");
  const prepublishResult = await $`bun prepublish`.quiet().nothrow();
  if (prepublishResult.exitCode !== 0) {
    console.error(prepublishResult.stderr.toString());
    return err("prepublish failed. Run 'bun prepublish' to debug.");
  }
  console.log("  ✓ prepublish succeeded\n");

  return ok(undefined);
};

/**
 * Create a bump plan based on changes and dependencies
 */
const createBumpPlan = async (bumpType: BumpType): Promise<Result<BumpPlan, string>> => {
  // Build dependency graph
  const graphResult = await buildDependencyGraph();
  if (graphResult.isErr()) {
    return err(graphResult.error);
  }
  const graph = graphResult.value;

  // Get last release tag
  const tagResult = await getLastReleaseTag();
  if (tagResult.isErr()) {
    return err(tagResult.error);
  }
  const lastTag = tagResult.value;

  console.log(`Last release tag: ${lastTag ?? "(none)"}`);

  // Detect direct changes
  const directChangesResult = await detectDirectChanges(graph, lastTag);
  if (directChangesResult.isErr()) {
    return err(directChangesResult.error);
  }
  const directChanges = directChangesResult.value;

  // Compute all packages to bump (including cascade)
  const toBump = computePackagesToBump(directChanges, graph);

  // Cascade changes = toBump - directChanges
  const cascadeChanges = new Set<string>();
  for (const pkg of toBump) {
    if (!directChanges.has(pkg)) {
      cascadeChanges.add(pkg);
    }
  }

  // Compute packages to skip
  const toSkip = new Set<string>();
  for (const name of graph.packages.keys()) {
    if (!toBump.has(name)) {
      toSkip.add(name);
    }
  }

  // Get root version and calculate new version
  const rootInfo = graph.packages.get("soda-gql");
  if (!rootInfo) {
    return err("Could not find root package");
  }

  const newVersionResult = incrementVersion(rootInfo.version, bumpType);
  if (newVersionResult.isErr()) {
    return err(newVersionResult.error);
  }

  return ok({
    toBump,
    toSkip,
    newVersion: newVersionResult.value,
    directChanges,
    cascadeChanges,
    graph,
  });
};

/**
 * Report the bump plan to console
 */
const reportBumpPlan = (plan: BumpPlan): void => {
  const { directChanges, cascadeChanges, toSkip, newVersion, graph } = plan;

  console.log(`New version: ${newVersion}\n`);

  // Direct changes
  console.log(`Direct changes (${directChanges.size}):`);
  for (const name of directChanges) {
    const info = graph.packages.get(name);
    if (info) {
      console.log(`  - ${name} (${info.packageDir})`);
    }
  }

  // Cascade changes
  if (cascadeChanges.size > 0) {
    console.log(`\nCascade bump (${cascadeChanges.size}):`);
    for (const name of cascadeChanges) {
      const info = graph.packages.get(name);
      if (info) {
        const deps = [...info.workspaceDeps].filter((d) => plan.toBump.has(d));
        console.log(`  - ${name} (depends on: ${deps.map((d) => d.replace("@soda-gql/", "")).join(", ")})`);
      }
    }
  }

  // Skipped packages
  if (toSkip.size > 0) {
    console.log(`\nSkipped (${toSkip.size}):`);
    for (const name of toSkip) {
      const info = graph.packages.get(name);
      if (info) {
        console.log(`  - ${name} (no changes)`);
      }
    }
  }
};

/**
 * Execute the bump plan
 */
const executeBumpPlan = async (
  plan: BumpPlan,
  dryRun: boolean,
): Promise<Result<Array<{ path: string; oldVersion: string; newVersion: string }>, string>> => {
  const results: Array<{ path: string; oldVersion: string; newVersion: string }> = [];

  // Get all package paths (to maintain order)
  const pathsResult = await getPackagePaths();
  if (pathsResult.isErr()) {
    return err(pathsResult.error);
  }

  for (const packagePath of pathsResult.value) {
    const pkgResult = await readPackageJson(packagePath);
    if (pkgResult.isErr()) {
      // Skip packages that can't be read
      continue;
    }

    const pkg = pkgResult.value;
    const oldVersion = pkg.version;

    // Check if this package should be bumped
    if (!plan.toBump.has(pkg.name)) {
      // Skip this package
      continue;
    }

    if (dryRun) {
      results.push({
        path: packagePath,
        oldVersion,
        newVersion: plan.newVersion,
      });
    } else {
      // Update version
      pkg.version = plan.newVersion;

      const writeResult = await writePackageJson(packagePath, pkg);
      if (writeResult.isErr()) {
        return err(writeResult.error);
      }

      results.push({
        path: packagePath,
        oldVersion,
        newVersion: plan.newVersion,
      });
    }
  }

  return ok(results);
};

/**
 * Create git commit and PR
 */
const createCommitAndPR = async (
  version: string,
  bumpType: BumpType,
  dryRun: boolean,
): Promise<void> => {
  const branchName = `release/v${version}`;
  const commitMessage = `chore: bump version to ${version} (${bumpType})`;

  if (dryRun) {
    console.log("\n[DRY RUN] Would execute the following git commands:");
    console.log(`  git checkout -b ${branchName}`);
    console.log(`  git add package.json packages/*/package.json packages/swc-transformer/npm/*/package.json bun.lockb`);
    console.log(`  git commit -m "${commitMessage}"`);
    console.log(`  git push -u origin ${branchName}`);
    console.log(`  gh pr create --title "${commitMessage}" --base main`);
    return;
  }

  // Create and checkout new branch
  await $`git checkout -b ${branchName}`;

  // Stage all package.json changes (including platform packages) and lockfile
  await $`git add package.json packages/*/package.json bun.lockb`;
  try {
    await $`git add packages/swc-transformer/npm/*/package.json`;
  } catch {
    // Platform packages may not exist yet
  }

  // Create commit
  await $`git commit -m ${commitMessage}`;

  // Push to remote
  await $`git push -u origin ${branchName}`;

  // Create PR using gh CLI
  const prBody = `## Summary
- Bump version from previous to ${version}
- Type: ${bumpType} version bump

## Changes
- Updated root package.json
- Updated all packages in packages/ directory
`;

  await $`gh pr create --title ${commitMessage} --body ${prBody} --base main`;
};

/**
 * Main function
 */
const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const bumpType = args[0] as BumpType | undefined;
  const dryRun = args.includes("--dry-run");
  const skipVerify = args.includes("--skip-verify");

  if (!bumpType || !["major", "minor", "patch"].includes(bumpType)) {
    console.error("Usage: bun scripts/bump-version.ts <major|minor|patch> [--dry-run] [--skip-verify]");
    process.exit(1);
  }

  if (dryRun) {
    console.log("[DRY RUN MODE]\n");
  }

  // Verify local build before proceeding (unless skipped)
  if (!skipVerify && !dryRun) {
    const verifyResult = await verifyLocalBuild();
    if (verifyResult.isErr()) {
      console.error(`\nError: ${verifyResult.error}`);
      console.error("\nUse --skip-verify to bypass this check.");
      process.exit(1);
    }
  } else if (skipVerify) {
    console.log("[SKIPPING LOCAL BUILD VERIFICATION]\n");
  }

  console.log(`Bumping ${bumpType} version...\n`);

  // Create bump plan
  const planResult = await createBumpPlan(bumpType);
  if (planResult.isErr()) {
    console.error(`Error: ${planResult.error}`);
    process.exit(1);
  }

  const plan = planResult.value;

  // Report what will happen
  reportBumpPlan(plan);

  // Execute (or simulate in dry-run)
  const executeResult = await executeBumpPlan(plan, dryRun);
  if (executeResult.isErr()) {
    console.error(`Error: ${executeResult.error}`);
    process.exit(1);
  }

  const results = executeResult.value;

  // Display version update summary
  console.log("\nVersion updates:");
  for (const { path: packagePath, oldVersion, newVersion } of results) {
    console.log(`  ${packagePath}: ${oldVersion} -> ${newVersion}`);
  }

  // Update lockfile
  if (!dryRun) {
    console.log("\nUpdating lockfile...");
    const installResult = await $`bun install`.quiet().nothrow();
    if (installResult.exitCode !== 0) {
      console.error(installResult.stderr.toString());
      console.error("Failed to update lockfile");
      process.exit(1);
    }
    console.log("✓ Lockfile updated");
  } else {
    console.log("\n[DRY RUN] Would run: bun install");
  }

  // Create commit and PR
  if (!dryRun) {
    console.log("\nCreating commit and PR...");
  }
  try {
    await createCommitAndPR(plan.newVersion, bumpType, dryRun);
    if (!dryRun) {
      console.log("\n✓ Successfully created commit and PR");
    } else {
      console.log("\n✓ Dry run completed successfully");
    }
  } catch (error) {
    console.error("Failed to create commit and PR:", error);
    process.exit(1);
  }
};

await main();
