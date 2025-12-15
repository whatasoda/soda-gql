import { $ } from "bun";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { err, ok, type Result } from "neverthrow";

type BumpType = "major" | "minor" | "patch";

type PackageJson = {
  name: string;
  version: string;
  [key: string]: unknown;
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
const incrementVersion = (
  version: string,
  bumpType: BumpType,
): Result<string, string> => {
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
 * Get all package.json paths
 */
const getPackagePaths = async (): Promise<Result<string[], string>> => {
  try {
    const packageDirs = await readdir("packages", { withFileTypes: true });
    const paths = packageDirs
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join("packages", entry.name, "package.json"));

    // Add root package.json
    paths.unshift("package.json");

    return ok(paths);
  } catch (error) {
    return err(`Failed to read packages directory: ${String(error)}`);
  }
};

/**
 * Bump version for a single package
 */
const bumpPackageVersion = async (
  filePath: string,
  bumpType: BumpType,
): Promise<Result<{ path: string; oldVersion: string; newVersion: string }, string>> => {
  const packageJsonResult = await readPackageJson(filePath);
  if (packageJsonResult.isErr()) {
    return err(packageJsonResult.error);
  }

  const packageJson = packageJsonResult.value;
  const oldVersion = packageJson.version;

  const newVersionResult = incrementVersion(oldVersion, bumpType);
  if (newVersionResult.isErr()) {
    return err(newVersionResult.error);
  }

  const newVersion = newVersionResult.value;
  packageJson.version = newVersion;

  const writeResult = await writePackageJson(filePath, packageJson);
  if (writeResult.isErr()) {
    return err(writeResult.error);
  }

  return ok({ path: filePath, oldVersion, newVersion });
};

/**
 * Create git commit and PR
 */
const createCommitAndPR = async (
  version: string,
  bumpType: BumpType,
  dryRun: boolean,
) => {
  const branchName = `release/v${version}`;
  const commitMessage = `chore: bump version to ${version} (${bumpType})`;

  if (dryRun) {
    console.log("\n[DRY RUN] Would execute the following git commands:");
    console.log(`  git checkout -b ${branchName}`);
    console.log(`  git add package.json packages/*/package.json`);
    console.log(`  git commit -m "${commitMessage}"`);
    console.log(`  git push -u origin ${branchName}`);
    console.log(`  gh pr create --title "${commitMessage}" --base main`);
    return;
  }

  // Create and checkout new branch
  await $`git checkout -b ${branchName}`;

  // Stage all package.json changes
  await $`git add package.json packages/*/package.json`;

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
const main = async () => {
  const args = process.argv.slice(2);
  const bumpType = args[0] as BumpType | undefined;
  const dryRun = args.includes("--dry-run");

  if (!bumpType || !["major", "minor", "patch"].includes(bumpType)) {
    console.error("Usage: bun scripts/bump-version.ts <major|minor|patch> [--dry-run]");
    process.exit(1);
  }

  if (dryRun) {
    console.log("[DRY RUN MODE]");
  }

  console.log(`Bumping ${bumpType} version...`);

  // Get all package paths
  const pathsResult = await getPackagePaths();
  if (pathsResult.isErr()) {
    console.error(pathsResult.error);
    process.exit(1);
  }

  const paths = pathsResult.value;

  // Bump all package versions (or simulate in dry-run mode)
  const results: Array<{ path: string; oldVersion: string; newVersion: string }> = [];
  for (const packagePath of paths) {
    if (dryRun) {
      // In dry-run mode, just read and calculate new version without writing
      const packageJsonResult = await readPackageJson(packagePath);
      if (packageJsonResult.isErr()) {
        console.error(packageJsonResult.error);
        process.exit(1);
      }
      const packageJson = packageJsonResult.value;
      const oldVersion = packageJson.version;
      const newVersionResult = incrementVersion(oldVersion, bumpType);
      if (newVersionResult.isErr()) {
        console.error(newVersionResult.error);
        process.exit(1);
      }
      results.push({
        path: packagePath,
        oldVersion,
        newVersion: newVersionResult.value,
      });
    } else {
      const result = await bumpPackageVersion(packagePath, bumpType);
      if (result.isErr()) {
        console.error(result.error);
        process.exit(1);
      }
      results.push(result.value);
    }
  }

  // Display results
  console.log("\nVersion updates:");
  for (const { path: packagePath, oldVersion, newVersion } of results) {
    console.log(`  ${packagePath}: ${oldVersion} → ${newVersion}`);
  }

  // Get the new version from root package.json
  const newVersion = results[0]?.newVersion;
  if (!newVersion) {
    console.error("Failed to get new version");
    process.exit(1);
  }

  // Create commit and PR
  if (!dryRun) {
    console.log("\nCreating commit and PR...");
  }
  try {
    await createCommitAndPR(newVersion, bumpType, dryRun);
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
