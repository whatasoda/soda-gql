import { join, resolve } from "node:path";

import { clearPseudoModuleRegistry } from "@soda-gql/core";
import { err, ok, type Result } from "neverthrow";
import { buildArtifact } from "./artifact";
import type { BuilderArtifact } from "./artifact/types";
import type { ModuleAnalysis } from "./ast";
import { createJsonCache } from "./cache/json-cache";
import { createDebugWriter } from "./debug/debug-writer";
import { buildDependencyGraph } from "./dependency-graph";
import { buildGraphIndex } from "./dependency-graph/patcher";
import type { DependencyGraph } from "./dependency-graph/types";
import { createDiscoveryCache, createDiscoveryPipeline } from "./discovery";
import { builderErrors } from "./errors";
import { createIntermediateModuleChunks } from "./internal/intermediate-module";
import type { WrittenChunkModule } from "./internal/intermediate-module/chunk-writer";
import { type ChunkManifest, planChunks } from "./internal/intermediate-module/chunks";
import type { BuilderError, BuilderInput, BuilderOptions, BuilderResult } from "./types";
import { writeArtifact } from "./writer";

type IntermediateChunks = {
  readonly manifest: ChunkManifest;
  readonly modules: Map<string, WrittenChunkModule>;
  readonly stats: {
    readonly written: number;
    readonly skipped: number;
  };
};

type PipelineData = {
  readonly analyses: readonly ModuleAnalysis[];
  readonly graph: DependencyGraph;
  readonly intermediateChunks: IntermediateChunks;
  readonly artifact: BuilderArtifact;
};

const buildPipeline = async (options: BuilderInput): Promise<Result<PipelineData, BuilderError>> => {
  const evaluatorId = options.evaluatorId ?? "default";
  clearPseudoModuleRegistry(evaluatorId);
  const cacheFactory = createJsonCache({
    rootDir: join(process.cwd(), ".cache", "soda-gql", "builder"),
    prefix: ["builder"],
  });

  const cache = createDiscoveryCache({
    factory: cacheFactory,
    analyzer: options.analyzer,
    evaluatorId,
  });

  // Compute metadata for discovery
  const metadata = {
    schemaHash: options.analyzer, // V1: Use analyzer as schema hash proxy
    analyzerVersion: options.analyzer,
  };

  const pipeline = createDiscoveryPipeline({
    analyzer: options.analyzer,
    cache,
    metadata,
  });
  const modules = pipeline.load(options.entry);

  if (modules.isErr()) {
    return err(modules.error);
  }

  const { stats, modules: analyses } = modules.value;

  const dependencyGraph = buildDependencyGraph(analyses);
  if (dependencyGraph.isErr()) {
    return err(builderErrors.graphCircularDependency(dependencyGraph.error.chain as readonly string[]));
  }

  const graph = dependencyGraph.value;
  const runtimeDir = join(process.cwd(), ".cache", "soda-gql", "builder", "runtime");
  const graphIndex = buildGraphIndex(graph);
  const manifest = planChunks(graph, graphIndex, runtimeDir);

  const intermediateChunksResult = await createIntermediateModuleChunks({
    graph,
    graphIndex,
    config: options.config,
    outDir: runtimeDir,
    evaluatorId,
  });

  if (intermediateChunksResult.isErr()) {
    return err(intermediateChunksResult.error);
  }

  const { written: chunkModules, skipped: chunksSkipped } = intermediateChunksResult.value;
  const chunkPaths = new Map<string, string>();
  for (const [chunkId, chunk] of chunkModules.entries()) {
    chunkPaths.set(chunkId, chunk.transpiledPath);
  }

  const chunkStats = { written: chunkModules.size, skipped: chunksSkipped };

  const artifactResult = await buildArtifact({
    graph,
    cache: stats,
    chunks: chunkStats,
    intermediateModulePaths: chunkPaths,
    evaluatorId,
  });

  if (artifactResult.isErr()) {
    return err(artifactResult.error);
  }

  return ok({
    analyses,
    graph,
    intermediateChunks: {
      manifest,
      modules: chunkModules,
      stats: chunkStats,
    },
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

  const { analyses, graph, intermediateChunks, artifact } = pipelineResult.value;

  await debugWriter.writeDiscoverySnapshot(analyses, graph);
  await debugWriter.writeIntermediateModule({
    manifest: intermediateChunks.manifest,
    chunks: intermediateChunks.modules,
    stats: intermediateChunks.stats,
  });
  await debugWriter.writeArtifact(artifact);

  return writeArtifact(resolve(options.outPath), artifact);
};
