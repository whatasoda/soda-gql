/**
 * Doctor command output formatting.
 * @module
 */

import type { CheckResult, CheckStatus, DoctorResult, DuplicatePackageData, VersionConsistencyData } from "./types";

const STATUS_SYMBOLS: Record<CheckStatus, string> = {
  pass: "\u2713", // checkmark
  warn: "!",
  fail: "\u2717", // X
  skip: "-",
};

/**
 * Type guard to check if data is an object (not null/primitive).
 */
const isObject = (data: unknown): data is Record<string, unknown> => {
  return typeof data === "object" && data !== null;
};

/**
 * Format a single check result for human output.
 */
const formatCheckResult = (result: CheckResult): string[] => {
  const lines: string[] = [];
  const symbol = STATUS_SYMBOLS[result.status];

  lines.push(`${symbol} ${result.message}`);

  // Add detailed data for failures/warnings
  if (result.status === "fail" || result.status === "warn") {
    const data = result.data;

    // Version consistency details
    if (isObject(data) && "packages" in data && "expectedVersion" in data) {
      const versionData = data as VersionConsistencyData;
      const mismatched = versionData.packages.filter((p) => p.isMismatch);
      for (const pkg of mismatched) {
        lines.push(`  ${pkg.name}: ${pkg.version}  <- mismatch`);
      }
      if (versionData.expectedVersion && mismatched.length > 0) {
        lines.push(`  Expected: ${versionData.expectedVersion}`);
      }
    }

    // Duplicate packages details
    if (isObject(data) && "duplicates" in data) {
      const dupData = data as DuplicatePackageData;
      for (const dup of dupData.duplicates) {
        lines.push(`  ${dup.name}:`);
        for (const instance of dup.instances) {
          lines.push(`    ${instance.version} at ${instance.path}`);
        }
      }
    }

    // Fix suggestion
    if (result.fix) {
      lines.push("");
      lines.push(`  Fix: ${result.fix}`);
    }
  }

  return lines;
};

/**
 * Format the complete doctor result for human output.
 */
export const formatDoctorResult = (result: DoctorResult): string => {
  const lines: string[] = [];

  lines.push(`soda-gql doctor v${result.version}`);
  lines.push("");

  for (const check of result.checks) {
    lines.push(...formatCheckResult(check));
    lines.push("");
  }

  // Summary
  const passed = result.checks.filter((c) => c.status === "pass").length;

  if (result.issueCount === 0 && result.warningCount === 0) {
    lines.push(`Summary: All ${passed} checks passed`);
  } else {
    const parts: string[] = [];
    if (result.issueCount > 0) {
      parts.push(`${result.issueCount} issue${result.issueCount > 1 ? "s" : ""}`);
    }
    if (result.warningCount > 0) {
      parts.push(`${result.warningCount} warning${result.warningCount > 1 ? "s" : ""}`);
    }
    lines.push(`Summary: ${parts.join(", ")} found`);
  }

  return lines.join("\n");
};
