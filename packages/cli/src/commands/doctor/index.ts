/**
 * Doctor command entry point.
 * @module
 */

import { ok } from "neverthrow";
import type { CommandResult, CommandSuccess } from "../../types";
import { checkCodegenFreshness } from "./checks/codegen-freshness";
import { checkConfigValidation } from "./checks/config-validation";
import { checkDuplicatePackages } from "./checks/duplicate-packages";
import { checkVersionConsistency } from "./checks/version-consistency";
import { getCliVersion, getTypescriptVersion } from "./discovery";
import { formatDoctorResult } from "./output";
import type { CheckResult, DoctorResult } from "./types";

const DOCTOR_HELP = `Usage: soda-gql doctor

Run diagnostic checks on your soda-gql installation.

Checks performed:
  - Version consistency across @soda-gql packages
  - Duplicate package detection
  - Config file validation
  - Codegen freshness (schema vs generated code)

Options:
  --help, -h    Show this help message
`;

type DoctorCommandResult = CommandResult<CommandSuccess & { data?: DoctorResult }>;

export const doctorCommand = (argv: readonly string[]): DoctorCommandResult => {
  if (argv.includes("--help") || argv.includes("-h")) {
    return ok({ message: DOCTOR_HELP });
  }

  const version = getCliVersion();
  const tsVersion = getTypescriptVersion();

  // Run all checks
  const checks: CheckResult[] = [];

  // Add TypeScript version as informational
  if (tsVersion) {
    checks.push({
      name: "TypeScript Version",
      status: "pass",
      message: `TypeScript version: ${tsVersion}`,
    });
  }

  // Phase 1 checks
  checks.push(checkVersionConsistency());
  checks.push(checkDuplicatePackages());

  // Phase 2 checks
  checks.push(checkConfigValidation());
  checks.push(checkCodegenFreshness());

  // Calculate summary
  const issueCount = checks.filter((c) => c.status === "fail").length;
  const warningCount = checks.filter((c) => c.status === "warn").length;

  const result: DoctorResult = {
    version,
    checks,
    issueCount,
    warningCount,
  };

  const message = formatDoctorResult(result);

  return ok({ message, data: result });
};
