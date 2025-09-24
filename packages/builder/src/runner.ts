import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { buildArtifact } from "./artifact";
import { detectCycles, detectDuplicates, extractProjectGraph } from "./discover";
import { loadModules } from "./module-loader";
import type { BuilderOptions, BuilderResult } from "./types";
import { writeArtifact } from "./writer";

export const runBuilder = async (options: BuilderOptions): Promise<BuilderResult> => {
  const modules = loadModules({ entry: options.entry, analyzer: options.analyzer });
  if (modules.isErr()) {
    return modules;
  }

  const { stats, sources, modules: analyses } = modules.value;
  const graph = extractProjectGraph(sources);

  const duplicateCheck = detectDuplicates(graph.queries);
  if (duplicateCheck.isErr()) {
    return duplicateCheck;
  }

  const cycleCheck = detectCycles(graph.slices);
  if (cycleCheck.isErr()) {
    return cycleCheck;
  }

  if (options.debugDir) {
    const debugPath = resolve(options.debugDir);
    mkdirSync(debugPath, { recursive: true });
    await Bun.write(
      resolve(debugPath, "modules.json"),
      JSON.stringify(analyses, null, 2),
    );
  }

  const artifactResult = await buildArtifact({
    queries: graph.queries,
    sliceCount: graph.slices.length,
    cache: stats,
  });

  if (artifactResult.isErr()) {
    return artifactResult;
  }

  if (options.debugDir) {
    const debugPath = resolve(options.debugDir);
    await Bun.write(
      resolve(debugPath, "artifact.json"),
      JSON.stringify(artifactResult.value, null, 2),
    );
  }

  return writeArtifact(resolve(options.outPath), artifactResult.value);
};
