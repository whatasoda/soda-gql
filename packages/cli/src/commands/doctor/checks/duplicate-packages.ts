/**
 * Duplicate packages check.
 * @module
 */

import { discoverAllSodaGqlPackages } from "../discovery";
import type { CheckResult, DuplicatePackageData } from "../types";

/**
 * Check for duplicate @soda-gql packages installed at different paths.
 */
export const checkDuplicatePackages = (): CheckResult<DuplicatePackageData> => {
  const packagesResult = discoverAllSodaGqlPackages();

  if (packagesResult.isErr()) {
    return {
      name: "Duplicate Packages",
      status: "skip",
      message: packagesResult.error,
      data: { duplicates: [] },
    };
  }

  const packages = packagesResult.value;

  // Group by package name
  const byName = new Map<string, typeof packages>();
  for (const pkg of packages) {
    const existing = byName.get(pkg.name) ?? [];
    existing.push(pkg);
    byName.set(pkg.name, existing);
  }

  // Find duplicates (same name, multiple paths)
  const duplicates: DuplicatePackageData["duplicates"][number][] = [];
  for (const [name, instances] of byName) {
    if (instances.length > 1) {
      duplicates.push({
        name,
        instances: instances.map((i) => ({
          path: i.path,
          version: i.version,
        })),
      });
    }
  }

  if (duplicates.length === 0) {
    return {
      name: "Duplicate Packages",
      status: "pass",
      message: "No duplicate packages detected",
      data: { duplicates: [] },
    };
  }

  const duplicateNames = duplicates.map((d) => d.name).join(", ");
  return {
    name: "Duplicate Packages",
    status: "warn",
    message: `Duplicate packages found: ${duplicateNames}`,
    data: { duplicates },
    fix: "Run: rm -rf node_modules && bun install",
  };
};
