import { join, resolve } from "node:path";

import { err } from "neverthrow";

import { buildArtifact } from "./artifact";
import { createDebugWriter } from "./debug/debug-writer";
import { buildDependencyGraph } from "./dependency-graph";
import { createIntermediateModule } from "./intermediate-module";
import { loadModules } from "./module-loader";
import type { BuilderOptions, BuilderResult } from "./types";
import { writeArtifact } from "./writer";

export const runBuilder = async (options: BuilderOptions): Promise<BuilderResult> => {
  const debugWriter = createDebugWriter(options.debugDir);

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

  await debugWriter.writeDiscoverySnapshot(analyses, dependencyGraph.value);

  const runtimeDir = join(process.cwd(), ".cache", "soda-gql", "builder", "runtime");
  const intermediateModule = await createIntermediateModule({
    graph: dependencyGraph.value,
    outDir: runtimeDir,
  });

  if (intermediateModule.isErr()) {
    return err(intermediateModule.error);
  }

  const { transpiledPath, sourceCode } = intermediateModule.value;

  await debugWriter.writeIntermediateModule({ sourceCode, transpiledPath });

  const artifactResult = await buildArtifact({
    graph: dependencyGraph.value,
    cache: stats,
    intermediateModulePath: transpiledPath,
  });

  if (artifactResult.isErr()) {
    return err(artifactResult.error);
  }

  await debugWriter.writeArtifact(artifactResult.value);

  return writeArtifact(resolve(options.outPath), artifactResult.value);
};
