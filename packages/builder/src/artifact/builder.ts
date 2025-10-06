import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../types";
import { aggregate } from "./aggregate";
import { checkIssues } from "./issue-handler";
import { loadIntermediateModules } from "./loader";
import type { BuildArtifactInput, BuilderArtifact } from "./types";

export const buildArtifact = async ({
  graph,
  cache,
  chunks,
  intermediateModulePath,
  intermediateModulePaths,
  evaluatorId,
}: BuildArtifactInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  const chunkPaths = intermediateModulePaths ?? (intermediateModulePath ? new Map([["", intermediateModulePath]]) : undefined);

  if (!chunkPaths) {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: "",
      astPath: "",
      message: "Either intermediateModulePath or intermediateModulePaths must be provided",
    });
  }

  // Chunk mode: load multiple chunks
  const moduleResult = await loadIntermediateModules({ chunkPaths, evaluatorId });
  if (moduleResult.isErr()) {
    return err(moduleResult.error);
  }
  const intermediateModule = moduleResult.value;

  // Check for errors
  const issuesResult = checkIssues(intermediateModule);
  if (issuesResult.isErr()) {
    return err(issuesResult.error);
  }

  const warnings = issuesResult.value;

  // Classify and register nodes
  const aggregationResult = aggregate({ graph, elements: intermediateModule.elements });
  if (aggregationResult.isErr()) {
    return err(aggregationResult.error);
  }

  const elementMap = aggregationResult.value;

  return ok({
    elements: Object.fromEntries(elementMap.entries()),
    report: {
      durationMs: 0,
      warnings,
      cache,
      chunks: chunks ?? { written: 0, skipped: 0 },
    },
  } satisfies BuilderArtifact);
};
