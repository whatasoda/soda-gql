import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../types";
import { aggregate } from "./aggregate";
import { checkIssues } from "./issue-handler";
import { loadIntermediateModule } from "./loader";
import type { BuildArtifactInput, BuilderArtifact } from "./types";

export const buildArtifact = async ({
  graph,
  cache,
  intermediateModulePath,
}: BuildArtifactInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  // Load intermediate module first to classify definitions at runtime
  const moduleResult = await loadIntermediateModule(intermediateModulePath);
  if (moduleResult.isErr()) {
    return err(moduleResult.error);
  }

  const intermediateModule = moduleResult.value;

  // Check for errors from issue registry
  const issuesResult = checkIssues(intermediateModule);
  if (issuesResult.isErr()) {
    return err(issuesResult.error);
  }

  const warnings = issuesResult.value;

  // Classify and register nodes
  const aggregationResult = aggregate(graph, intermediateModule);
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
    },
  } satisfies BuilderArtifact);
};
