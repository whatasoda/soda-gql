import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../types";
import { aggregate } from "./aggregate";
import { checkIssues } from "./issue-handler";
import { loadIntermediateModules } from "./loader";
import type { BuildArtifactInput, BuilderArtifact } from "./types";

const LEGACY_CHUNK_ID = "__legacy__";

export const buildArtifact = async ({
  graph,
  cache,
  chunks,
  intermediateModulePath,
  intermediateModulePaths,
  evaluatorId,
}: BuildArtifactInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  const chunkPaths =
    intermediateModulePaths ??
    (intermediateModulePath ? new Map([[LEGACY_CHUNK_ID, intermediateModulePath]]) : new Map<string, string>());

  if (chunkPaths.size === 0) {
    return err({
      code: "RUNTIME_MODULE_LOAD_FAILED",
      filePath: "",
      astPath: "",
      message: "Either intermediateModulePath or intermediateModulePaths must be provided",
    });
  }

  const chunkReport = chunks ?? { written: chunkPaths.size, skipped: 0 };

  // Load intermediate chunks and register them
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
      chunks: chunkReport,
    },
  } satisfies BuilderArtifact);
};
