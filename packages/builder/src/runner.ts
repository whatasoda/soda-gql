import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { err } from "neverthrow";

import { buildArtifact } from "./artifact";
import { buildDependencyGraph } from "./dependency-graph";
import { createIntermediateModule } from "./intermediate-module";
import { loadModules } from "./module-loader";
import type { BuilderOptions, BuilderResult } from "./types";
import { writeArtifact } from "./writer";

export const runBuilder = async (options: BuilderOptions): Promise<BuilderResult> => {
  const modules = loadModules({ entry: options.entry, analyzer: options.analyzer });
  if (modules.isErr()) {
    return err(modules.error);
  }

  const { stats, modules: analyses } = modules.value;

  const dependencyGraph = buildDependencyGraph(analyses);
  if (dependencyGraph.isErr()) {
    return err({
      code: "CIRCULAR_DEPENDENCY",
      chain: dependencyGraph.error.chain,
    });
  }

  const runtimeDir = join(process.cwd(), ".cache", "soda-gql", "builder", "runtime");
  const intermediateModule = await createIntermediateModule({
    graph: dependencyGraph.value,
    outDir: runtimeDir,
  });

  if (intermediateModule.isErr()) {
    return err(intermediateModule.error);
  }

  const { transpiledPath, sourceCode } = intermediateModule.value;

  if (options.debugDir) {
    const debugPath = resolve(options.debugDir);
    mkdirSync(debugPath, { recursive: true });
    await Bun.write(resolve(debugPath, "modules.json"), JSON.stringify(analyses, null, 2));
    await Bun.write(resolve(debugPath, "graph.json"), JSON.stringify(Array.from(dependencyGraph.value.entries()), null, 2));
    await Bun.write(resolve(debugPath, "intermediate-module.ts"), sourceCode);
    await Bun.write(resolve(debugPath, "intermediate-module.mjs"), await Bun.file(transpiledPath).text());
  }

  const artifactResult = await buildArtifact({
    graph: dependencyGraph.value,
    cache: stats,
    intermediateModulePath: transpiledPath,
  });

  if (artifactResult.isErr()) {
    return err(artifactResult.error);
  }

  if (options.debugDir) {
    const debugPath = resolve(options.debugDir);
    await Bun.write(resolve(debugPath, "artifact.json"), JSON.stringify(artifactResult.value, null, 2));
  }

  return writeArtifact(resolve(options.outPath), artifactResult.value);
};
