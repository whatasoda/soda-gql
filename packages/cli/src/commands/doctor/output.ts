/**
 * Doctor command output formatting.
 * @module
 */

import type {
  CheckResult,
  CheckStatus,
  DoctorResult,
  DuplicatePackageData,
  VersionConsistencyData,
} from "./types";

const STATUS_SYMBOLS: Record<CheckStatus, string> = {
  pass: "\u2713", // checkmark
  warn: "!",
  fail: "\u2717", // X
  skip: "-",
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
    // Version consistency details
    if (result.data && "packages" in result.data && "expectedVersion" in result.data) {
      const data = result.data as VersionConsistencyData;
      const mismatched = data.packages.filter((p) => p.isMismatch);
      for (const pkg of mismatched) {
        lines.push(`  ${pkg.name}: ${pkg.version}  <- mismatch`);
      }
      if (data.expectedVersion && mismatched.length > 0) {
        lines.push(`  Expected: ${data.expectedVersion}`);
      }
    }

    // Duplicate packages details
    if (result.data && "duplicates" in result.data) {
      const data = result.data as DuplicatePackageData;
      for (const dup of data.duplicates) {
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
