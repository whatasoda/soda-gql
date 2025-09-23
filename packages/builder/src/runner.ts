import { resolve } from "node:path";

import { buildArtifact } from "./artifact";
import { detectCycles, detectDuplicates, extractProjectGraph } from "./discover";
import { loadModules } from "./module-loader";
import type { BuilderOptions, BuilderResult } from "./types";
import { writeArtifact } from "./writer";

export const runBuilder = async (options: BuilderOptions): Promise<BuilderResult> => {
  const modules = loadModules({ entry: options.entry });
  if (modules.isErr()) {
    return modules;
  }

  const { stats, sources } = modules.value;
  const graph = extractProjectGraph(sources);

  const duplicateCheck = detectDuplicates(graph.queries);
  if (duplicateCheck.isErr()) {
    return duplicateCheck;
  }

  const cycleCheck = detectCycles(graph.slices);
  if (cycleCheck.isErr()) {
    return cycleCheck;
  }

  const artifactResult = await buildArtifact({
    queries: graph.queries,
    sliceCount: graph.slices.length,
    cache: stats,
  });

  if (artifactResult.isErr()) {
    return artifactResult;
  }

  return writeArtifact(resolve(options.outPath), artifactResult.value);
};
