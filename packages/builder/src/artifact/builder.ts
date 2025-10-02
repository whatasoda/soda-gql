import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../types";
import { classifyAndRegister } from "./classifier";
import { checkIssues } from "./issue-handler";
import { loadIntermediateModule } from "./loader";
import { createOperationRegistry } from "./registry";
import type { BuildArtifactInput, BuilderArtifact } from "./types";

export const buildArtifact = async ({
  graph,
  cache,
  intermediateModulePath,
}: BuildArtifactInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  const registry = createOperationRegistry();

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
  const classifyResult = classifyAndRegister(graph, intermediateModule, registry);
  if (classifyResult.isErr()) {
    return err(classifyResult.error);
  }

  const snapshot = registry.snapshot();

  return ok({
    artifacts: snapshot.artifacts,
    report: {
      operations: snapshot.counts.operations,
      models: snapshot.counts.models,
      slices: snapshot.counts.slices,
      durationMs: 0,
      warnings,
      cache,
    },
  } satisfies BuilderArtifact);
};
