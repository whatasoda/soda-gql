import type { Issue } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import type { IntermediateModule } from "../intermediate-module";
import type { BuilderError } from "../types";

const canonicalToFilePath = (canonicalId: string): string => canonicalId.split("::")[0] ?? canonicalId;

/**
 * Convert issues to BuilderError if any errors exist
 * Returns null if no errors found
 */
export const toBuilderError = (issues: readonly Issue[]): BuilderError | null => {
  for (const issue of issues) {
    if (issue.severity === "error") {
      // Convert issue to BuilderError
      if (issue.code === "DUPLICATE_OPERATION_NAME") {
        const sources = [canonicalToFilePath(issue.canonicalId)];
        if (issue.related) {
          sources.unshift(...issue.related.map(canonicalToFilePath));
        }
        return {
          code: "DOC_DUPLICATE",
          name: issue.message.match(/"([^"]+)"/)?.[1] ?? "unknown",
          sources,
        };
      }
      // Handle other error codes if needed
      return {
        code: "MODULE_EVALUATION_FAILED",
        filePath: canonicalToFilePath(issue.canonicalId),
        astPath: "",
        message: issue.message,
      };
    }
  }
  return null;
};

export const checkIssues = (intermediateModule: IntermediateModule): Result<string[], BuilderError> => {
  const { issueRegistry } = intermediateModule;
  const issues = issueRegistry.getIssues();
  const warnings: string[] = [];

  const error = toBuilderError(issues);
  if (error) {
    return err(error);
  }

  for (const issue of issues) {
    if (issue.severity === "warning") {
      warnings.push(`${issue.code}: ${issue.message} (${issue.canonicalId})`);
    }
  }

  return ok(warnings);
};
