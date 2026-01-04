/**
 * Version consistency check.
 * @module
 */

import { discoverAllSodaGqlPackages } from "../discovery";
import type { CheckResult, VersionConsistencyData } from "../types";

/**
 * Check that all @soda-gql packages have consistent versions.
 */
export const checkVersionConsistency = (): CheckResult<VersionConsistencyData> => {
  const packagesResult = discoverAllSodaGqlPackages();

  if (packagesResult.isErr()) {
    return {
      name: "Version Consistency",
      status: "skip",
      message: packagesResult.error,
      data: { packages: [], expectedVersion: null },
    };
  }

  const packages = packagesResult.value;

  if (packages.length === 0) {
    return {
      name: "Version Consistency",
      status: "skip",
      message: "No @soda-gql packages found",
      data: { packages: [], expectedVersion: null },
    };
  }

  // Group by package name (to handle duplicates separately)
  const byName = new Map<string, typeof packages>();
  for (const pkg of packages) {
    const existing = byName.get(pkg.name) ?? [];
    existing.push(pkg);
    byName.set(pkg.name, existing);
  }

  // Get unique packages (first instance of each)
  const uniquePackages = Array.from(byName.values()).map((instances) => instances[0]!);

  // Determine expected version (most common version)
  const versionCounts = new Map<string, number>();
  for (const pkg of uniquePackages) {
    versionCounts.set(pkg.version, (versionCounts.get(pkg.version) ?? 0) + 1);
  }

  let expectedVersion = uniquePackages[0]?.version ?? null;
  let maxCount = 0;
  for (const [version, count] of versionCounts) {
    if (count > maxCount) {
      maxCount = count;
      expectedVersion = version;
    }
  }

  // Find mismatches
  const packageResults = uniquePackages.map((pkg) => ({
    name: pkg.name,
    version: pkg.version,
    path: pkg.path,
    isMismatch: pkg.version !== expectedVersion,
  }));

  const mismatches = packageResults.filter((p) => p.isMismatch);

  if (mismatches.length === 0) {
    return {
      name: "Version Consistency",
      status: "pass",
      message: `All ${uniquePackages.length} packages at version ${expectedVersion}`,
      data: { packages: packageResults, expectedVersion },
    };
  }

  const mismatchNames = mismatches.map((p) => p.name).join(", ");
  return {
    name: "Version Consistency",
    status: "fail",
    message: `Version mismatch: ${mismatchNames}`,
    data: { packages: packageResults, expectedVersion },
    fix: `Run: bun update ${mismatches.map((p) => p.name).join(" ")}`,
  };
};
