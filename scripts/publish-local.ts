import { $ } from "bun";
import { readdir, rm, mkdir } from "node:fs/promises";
import path from "node:path";

interface PublishOptions {
  version: string;
  publishDir: string;
  dryRun: boolean;
  otp?: string;
}

interface PublishStatus {
  /** Packages that need a new version published (already exist on npm) */
  needsPublish: string[];
  /** Packages that are already published at this version */
  alreadyPublished: string[];
  /** Packages that have never been published (first-time publish) */
  needsInitialPublish: string[];
}

/**
 * Get the publish directory for a specific version
 */
const getPublishDir = (version: string): string => {
  const tag = version.startsWith("v") ? version : `v${version}`;
  return path.join(".publish", tag);
};

/**
 * Download release artifacts from GitHub
 */
const downloadArtifacts = async (version: string): Promise<string> => {
  const tag = version.startsWith("v") ? version : `v${version}`;
  const publishDir = getPublishDir(version);

  console.log(`Downloading artifacts for ${tag}...`);

  // Clean up existing version directory
  await rm(publishDir, { recursive: true, force: true });
  await mkdir(publishDir, { recursive: true });

  // Download release asset
  try {
    await $`gh release download ${tag} --pattern "publish-packages-*.tar.gz" --dir .`;
  } catch (error) {
    console.error(`Failed to download release artifacts for ${tag}`);
    console.error("Make sure the release exists and has artifacts attached.");
    throw error;
  }

  // Extract to version-specific directory
  await $`tar -xzf publish-packages-${tag}.tar.gz -C ${publishDir}`;

  // Cleanup tar file
  await $`rm -f publish-packages-${tag}.tar.gz`;

  console.log(`Artifacts downloaded and extracted to ${publishDir}/`);
  return publishDir;
};

/**
 * Check which packages need publishing
 */
const checkPublishStatus = async (version: string, publishDir: string): Promise<PublishStatus> => {
  const result: PublishStatus = {
    needsPublish: [],
    alreadyPublished: [],
    needsInitialPublish: [],
  };

  const packages = await readdir(publishDir, { withFileTypes: true });

  for (const pkg of packages) {
    if (!pkg.isDirectory()) continue;

    const pkgName = `@soda-gql/${pkg.name}`;

    try {
      // Check if this version is already published
      await $`npm view ${pkgName}@${version} version`.quiet();
      result.alreadyPublished.push(pkgName);
    } catch {
      // Check if package has ever been published
      try {
        await $`npm view ${pkgName} versions`.quiet();
        // Package exists but this version is not published
        result.needsPublish.push(pkgName);
      } catch {
        // Package has never been published
        result.needsInitialPublish.push(pkgName);
      }
    }
  }

  return result;
};

/**
 * Publish packages to npm
 */
const publishPackages = async ({ version, publishDir, dryRun, otp }: PublishOptions): Promise<void> => {
  const status = await checkPublishStatus(version, publishDir);

  const totalNeedsPublish = status.needsPublish.length + status.needsInitialPublish.length;

  console.log("\n=== Publish Status ===");
  console.log(`Already published: ${status.alreadyPublished.length}`);
  console.log(`Needs publish (existing packages): ${status.needsPublish.length}`);
  console.log(`Needs initial publish (new packages): ${status.needsInitialPublish.length}`);

  if (status.needsInitialPublish.length > 0) {
    console.log("\nNew packages (first-time publish):");
    for (const pkg of status.needsInitialPublish) {
      console.log(`  - ${pkg}`);
    }
  }

  if (status.needsPublish.length > 0) {
    console.log("\nExisting packages (new version):");
    for (const pkg of status.needsPublish) {
      console.log(`  - ${pkg}`);
    }
  }

  // OTP is always required for local publish
  if (totalNeedsPublish > 0 && !otp && !dryRun) {
    console.error("\nError: OTP is required for local publish.");
    console.error("Run with --otp <code>");
    process.exit(1);
  }

  if (totalNeedsPublish === 0) {
    console.log("\nAll packages already published!");
    return;
  }

  console.log("\n=== Publishing ===");

  const packages = await readdir(publishDir, { withFileTypes: true });

  for (const pkg of packages) {
    if (!pkg.isDirectory()) continue;

    const pkgName = `@soda-gql/${pkg.name}`;
    const pkgDir = path.join(publishDir, pkg.name);

    if (status.alreadyPublished.includes(pkgName)) {
      console.log(`Skipping ${pkgName} (already published)`);
      continue;
    }

    const isInitial = status.needsInitialPublish.includes(pkgName);
    console.log(`Publishing ${pkgName}${isInitial ? " (initial)" : ""}...`);

    const args = ["--access", "public"];
    if (dryRun) args.push("--dry-run");
    if (otp) args.push("--otp", otp);

    try {
      await $`npm publish ${args}`.cwd(pkgDir);
      console.log(`  ✓ ${pkgName} published`);
    } catch (error) {
      console.error(`  ✗ ${pkgName} failed:`, error);
      if (!dryRun) {
        process.exit(1);
      }
    }
  }
};

/**
 * Main entry point
 */
const main = async () => {
  const args = process.argv.slice(2);

  // Check for help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: bun scripts/publish-local.ts <version> [options]

Options:
  --dry-run        Run without actually publishing
  --otp <code>     Provide OTP code (required for publishing)
  --help, -h       Show this help message

Examples:
  bun scripts/publish-local.ts v0.2.0 --dry-run
  bun scripts/publish-local.ts v0.2.0 --otp 123456

Artifacts are downloaded to .publish/<version>/ directory.`);
    process.exit(0);
  }

  // Parse arguments
  const versionIndex = args.findIndex((a) => !a.startsWith("--"));
  const version = versionIndex >= 0 ? args[versionIndex] : undefined;
  const dryRun = args.includes("--dry-run");
  const otpIndex = args.indexOf("--otp");
  const otp = otpIndex >= 0 ? args[otpIndex + 1] : undefined;

  if (!version) {
    console.error("Error: Version is required");
    console.error("Usage: bun scripts/publish-local.ts <version> [--dry-run] [--otp <code>]");
    process.exit(1);
  }

  // Verify gh CLI is available
  try {
    await $`gh auth status`.quiet();
  } catch {
    console.error("Error: GitHub CLI (gh) not authenticated.");
    console.error("Run: gh auth login");
    process.exit(1);
  }

  // Download artifacts to version-specific directory
  const publishDir = await downloadArtifacts(version);

  // Publish packages
  await publishPackages({
    version: version.replace(/^v/, ""),
    publishDir,
    dryRun,
    otp,
  });

  console.log("\n✓ Done!");
};

await main();
