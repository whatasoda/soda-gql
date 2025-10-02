import { join, resolve } from "node:path";

import { err, ok, type Result } from "neverthrow";
import { buildArtifact } from "./artifact";
import type { ModuleAnalysis } from "./ast";
import { createJsonCache } from "./cache/json-cache";
import { createDebugWriter } from "./debug/debug-writer";
import { buildDependencyGraph } from "./dependency-graph";
import type { DependencyGraph } from "./dependency-graph/types";
import { createDiscoveryCache, createDiscoveryPipeline } from "./discovery";
import { createIntermediateModule } from "./intermediate-module";
import type { BuilderArtifact, BuilderError, BuilderInput, BuilderOptions, BuilderResult } from "./types";
import { writeArtifact } from "./writer";

type PipelineData = {
  readonly analyses: readonly ModuleAnalysis[];
  readonly graph: DependencyGraph;
  readonly intermediateModule: {
    readonly transpiledPath: string;
    readonly sourceCode: string;
  };
  readonly artifact: BuilderArtifact;
};

const buildPipeline = async (options: BuilderInput): Promise<Result<PipelineData, BuilderError>> => {
  const cacheFactory = createJsonCache({
    rootDir: join(process.cwd(), ".cache", "soda-gql", "builder"),
    prefix: ["builder"],
  });

  const cache = createDiscoveryCache({
    factory: cacheFactory,
    analyzer: options.analyzer,
    evaluatorId: "default",
  });

  const pipeline = createDiscoveryPipeline({ analyzer: options.analyzer, cache });
  const modules = pipeline.load(options.entry);

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

  const artifactResult = await buildArtifact({
    graph: dependencyGraph.value,
    cache: stats,
    intermediateModulePath: transpiledPath,
  });

  if (artifactResult.isErr()) {
    return err(artifactResult.error);
  }

  return ok({
    analyses,
    graph: dependencyGraph.value,
    intermediateModule: { transpiledPath, sourceCode },
    artifact: artifactResult.value,
  });
};

export const generateArtifact = async (options: BuilderInput): Promise<Result<BuilderArtifact, BuilderError>> => {
  const result = await buildPipeline(options);
  if (result.isErr()) {
    return err(result.error);
  }
  return ok(result.value.artifact);
};

export const runBuilder = async (options: BuilderOptions): Promise<BuilderResult> => {
  const debugWriter = createDebugWriter(options.debugDir);

  const pipelineResult = await buildPipeline(options);

  if (pipelineResult.isErr()) {
    return err(pipelineResult.error);
  }

  const { analyses, graph, intermediateModule, artifact } = pipelineResult.value;

  await debugWriter.writeDiscoverySnapshot(analyses, graph);
  await debugWriter.writeIntermediateModule(intermediateModule);
  await debugWriter.writeArtifact(artifact);

  return writeArtifact(resolve(options.outPath), artifact);
};
