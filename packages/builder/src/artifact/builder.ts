import { createIssueRegistry, type IntermediateArtifactElement } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import type { IntermediateModule } from "../intermediate-module";
import type { BuilderError } from "../types";
import { aggregate } from "./aggregate";
import { checkIssues } from "./issue-handler";
import { loadIntermediateModule } from "./loader";
import type { BuildArtifactInput, BuilderArtifact } from "./types";

/**
 * Load multiple chunk modules and merge their elements.
 */
export const loadChunkModules = async (
  chunkPaths: Map<string, string>,
): Promise<Result<IntermediateModule, BuilderError>> => {
  const mergedElements: Record<string, IntermediateArtifactElement> = {};
  const issueRegistry = createIssueRegistry();

  for (const [_chunkId, transpiledPath] of chunkPaths.entries()) {
    const moduleResult = await loadIntermediateModule(transpiledPath);
    if (moduleResult.isErr()) {
      return err(moduleResult.error);
    }

    const module = moduleResult.value;

    // Merge elements
    Object.assign(mergedElements, module.elements);

    // Accumulate issues
    for (const issue of module.issueRegistry.getIssues()) {
      issueRegistry.addIssue(issue);
    }
  }

  return ok({ elements: mergedElements, issueRegistry });
};

export const buildArtifact = async ({
  graph,
  cache,
  intermediateModulePath,
  intermediateModulePaths,
}: BuildArtifactInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  // Load intermediate module(s)
  let intermediateModule: IntermediateModule;

  if (intermediateModulePaths) {
    // Chunk mode: load multiple chunks
    const moduleResult = await loadChunkModules(intermediateModulePaths);
    if (moduleResult.isErr()) {
      return err(moduleResult.error);
    }
    intermediateModule = moduleResult.value;
  } else if (intermediateModulePath) {
    // Legacy mode: single file
    const moduleResult = await loadIntermediateModule(intermediateModulePath);
    if (moduleResult.isErr()) {
      return err(moduleResult.error);
    }
    intermediateModule = moduleResult.value;
  } else {
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath: "",
      astPath: "",
      message: "Either intermediateModulePath or intermediateModulePaths must be provided",
    });
  }

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
