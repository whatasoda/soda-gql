import { $ } from "bun";
import { readdir, rm, mkdir, access } from "node:fs/promises";
import path from "node:path";

interface PublishOptions {
  version: string;
  dryRun: boolean;
  otp?: string;
}

/**
 * Download release artifacts from GitHub
 */
const downloadArtifacts = async (version: string): Promise<void> => {
  const tag = version.startsWith("v") ? version : `v${version}`;

  console.log(`Downloading artifacts for ${tag}...`);

  // Clean up existing dist directory
  await rm("dist", { recursive: true, force: true });
  await mkdir("dist", { recursive: true });

  // Download release asset
  try {
    await $`gh release download ${tag} --pattern "publish-packages-*.tar.gz" --dir .`;
  } catch (error) {
    console.error(`Failed to download release artifacts for ${tag}`);
    console.error("Make sure the release exists and has artifacts attached.");
    throw error;
  }

  // Extract to dist
  await $`tar -xzf publish-packages-${tag}.tar.gz -C dist`;

  // Cleanup tar file
  await $`rm -f publish-packages-${tag}.tar.gz`;

  console.log("Artifacts downloaded and extracted to dist/");
};

/**
 * Check which packages need publishing
 */
const checkPublishStatus = async (
  version: string,
): Promise<{
  needsPublish: string[];
  alreadyPublished: string[];
  needsOtp: string[];
}> => {
  const result = {
    needsPublish: [] as string[],
    alreadyPublished: [] as string[],
    needsOtp: [] as string[],
  };

  const packages = await readdir("dist", { withFileTypes: true });

  for (const pkg of packages) {
    if (!pkg.isDirectory()) continue;

    const pkgName = `@soda-gql/${pkg.name}`;

    try {
      // Check if this version is already published
      await $`npm view ${pkgName}@${version} version`.quiet();
      result.alreadyPublished.push(pkgName);
    } catch {
      result.needsPublish.push(pkgName);

      // Check if package has ever been published
      try {
        await $`npm view ${pkgName} versions`.quiet();
      } catch {
        result.needsOtp.push(pkgName);
      }
    }
  }

  return result;
};

/**
 * Publish packages to npm
 */
const publishPackages = async ({ version, dryRun, otp }: PublishOptions): Promise<void> => {
  const status = await checkPublishStatus(version);

  console.log("\n=== Publish Status ===");
  console.log(`Already published: ${status.alreadyPublished.length}`);
  console.log(`Needs publish: ${status.needsPublish.length}`);
  console.log(`Needs OTP (first publish): ${status.needsOtp.length}`);

  if (status.needsOtp.length > 0) {
    console.log("\nPackages needing OTP (first-time publish):");
    for (const pkg of status.needsOtp) {
      console.log(`  - ${pkg}`);
    }
  }

  if (status.needsOtp.length > 0 && !otp && !dryRun) {
    console.error("\nError: Some packages need OTP for first publish.");
    console.error("Run with --otp <code>");
    process.exit(1);
  }

  if (status.needsPublish.length === 0) {
    console.log("\nAll packages already published!");
    return;
  }

  console.log("\n=== Publishing ===");

  const packages = await readdir("dist", { withFileTypes: true });

  for (const pkg of packages) {
    if (!pkg.isDirectory()) continue;

    const pkgName = `@soda-gql/${pkg.name}`;
    const pkgDir = path.join("dist", pkg.name);

    if (status.alreadyPublished.includes(pkgName)) {
      console.log(`Skipping ${pkgName} (already published)`);
      continue;
    }

    console.log(`Publishing ${pkgName}...`);

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
  --otp <code>     Provide OTP code for first-time publish
  --skip-download  Skip downloading artifacts (use existing dist/)
  --help, -h       Show this help message

Examples:
  bun scripts/publish-local.ts v0.2.0 --dry-run
  bun scripts/publish-local.ts v0.2.0 --otp 123456
  bun scripts/publish-local.ts v0.2.0 --skip-download`);
    process.exit(0);
  }

  // Parse arguments
  const versionIndex = args.findIndex((a) => !a.startsWith("--"));
  const version = versionIndex >= 0 ? args[versionIndex] : undefined;
  const dryRun = args.includes("--dry-run");
  const otpIndex = args.indexOf("--otp");
  const otp = otpIndex >= 0 ? args[otpIndex + 1] : undefined;
  const skipDownload = args.includes("--skip-download");

  if (!version) {
    console.error("Error: Version is required");
    console.error("Usage: bun scripts/publish-local.ts <version> [--dry-run] [--otp <code>] [--skip-download]");
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

  // Download artifacts (unless skipped)
  if (!skipDownload) {
    await downloadArtifacts(version);
  } else {
    // Verify dist directory exists
    try {
      await access("dist");
    } catch {
      console.error("Error: dist/ directory not found. Run without --skip-download first.");
      process.exit(1);
    }
  }

  // Publish packages
  await publishPackages({
    version: version.replace(/^v/, ""),
    dryRun,
    otp,
  });

  console.log("\n✓ Done!");
};

await main();
