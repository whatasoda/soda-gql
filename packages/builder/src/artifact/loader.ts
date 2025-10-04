import { pathToFileURL } from "node:url";
import { err, ok, type Result } from "neverthrow";
import { getActiveRegistry, setActiveRegistry } from "@soda-gql/core";
import type { IntermediateModule } from "../intermediate-module";
import type { BuilderError } from "../types";
import { toBuilderError } from "./issue-handler";

export const loadIntermediateModule = async (
  intermediateModulePath: string,
): Promise<Result<IntermediateModule, BuilderError>> => {
  try {
    const module = (await import(pathToFileURL(intermediateModulePath).href)) as IntermediateModule;
    // Clear active registry after successful import
    setActiveRegistry(null);
    return ok(module);
  } catch (error) {
    // Try to retrieve issues from active registry before clearing
    const registry = getActiveRegistry();
    const issues = registry?.getIssues() ?? [];
    setActiveRegistry(null);

    // Check if we have actionable issues (e.g., duplicate operation names)
    if (issues.length > 0) {
      const builderError = toBuilderError(issues);
      if (builderError) {
        return err(builderError);
      }
    }

    // Fallback to generic MODULE_EVALUATION_FAILED
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: intermediateModulePath,
      astPath: "runtime",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
