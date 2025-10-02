import { err, ok, type Result } from "neverthrow";
import { createOperationRegistry } from "./registry";
import type { BuilderArtifact, BuilderError } from "../types";
import { classifyAndRegister } from "./classifier";
import { checkIssues } from "./issue-handler";
import { loadIntermediateModule } from "./loader";
import type { BuildArtifactInput } from "./types";

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

  const nodesByType = classifyResult.value;
  const snapshot = registry.snapshot();

  return ok({
    operations: snapshot.operations,
    slices: snapshot.slices,
    models: snapshot.models,
    report: {
      operations: nodesByType.get("operation")?.length ?? 0,
      models: nodesByType.get("model")?.length ?? 0,
      slices: nodesByType.get("slice")?.length ?? 0,
      durationMs: 0,
      warnings,
      cache,
    },
  } satisfies BuilderArtifact);
};
