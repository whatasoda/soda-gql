import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, type Result } from "neverthrow";
import type { DependencyGraph } from "../../dependency-graph";
import type { GraphIndex } from "../../dependency-graph/patcher";
import type { BuilderError } from "../../types";
import { analyzeGraph } from "./analysis";
import { type WrittenChunkModule, writeChunkModules } from "./chunk-writer";
import { buildIntermediateModuleSource } from "./codegen";
import { emitIntermediateModule } from "./emitter";
import { resolveCoreImportPath, resolveGqlImportPath } from "./gql-import";
import { buildChunkModules } from "./per-chunk-emission";

export type CreateIntermediateModuleInput = {
  readonly graph: DependencyGraph;
  readonly config: ResolvedSodaGqlConfig;
  readonly outDir: string;
  readonly evaluatorId: string;
};

/**
 * DEPRECATED: Legacy single-file emission.
 * Use createIntermediateModuleChunks for new code.
 */
export const createIntermediateModule = async ({
  graph,
  config,
  outDir,
  evaluatorId,
}: CreateIntermediateModuleInput): Promise<Result<{ transpiledPath: string; sourceCode: string }, BuilderError>> => {
  // Analyze the graph
  const { fileGroups, summaries, missingExpressions } = analyzeGraph(graph);

  // Check for missing expressions
  if (missingExpressions.length > 0) {
    const [first] = missingExpressions;
    const filePath = first?.filePath ?? outDir;
    const astPath = first?.definition.astPath ?? "";
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath,
      astPath,
      message: "MISSING_EXPRESSION",
    });
  }

  // Determine import paths from config
  const gqlImportPath = resolveGqlImportPath({ config, outDir });
  const coreImportPath = resolveCoreImportPath({ config, outDir });

  // Generate code
  const sourceCode = buildIntermediateModuleSource({ fileGroups, summaries, gqlImportPath, coreImportPath, evaluatorId });

  // Emit the module
  const emitResult = await emitIntermediateModule({ outDir, sourceCode });

  return emitResult.map(({ transpiledPath }) => ({ transpiledPath, sourceCode }));
};

export type CreateIntermediateModuleChunksInput = {
  readonly graph: DependencyGraph;
  readonly graphIndex: GraphIndex;
  readonly config: ResolvedSodaGqlConfig;
  readonly outDir: string;
  readonly evaluatorId: string;
};

export type CreateIntermediateModuleChunksResult = {
  readonly written: Map<string, WrittenChunkModule>;
  readonly skipped: number;
};

/**
 * Create intermediate modules per chunk (one chunk per source file).
 * Returns written chunks and skip statistics.
 */
export const createIntermediateModuleChunks = async ({
  graph,
  graphIndex,
  config,
  outDir,
  evaluatorId,
}: CreateIntermediateModuleChunksInput): Promise<Result<CreateIntermediateModuleChunksResult, BuilderError>> => {
  // Check for missing expressions
  const { missingExpressions } = analyzeGraph(graph);
  if (missingExpressions.length > 0) {
    const [first] = missingExpressions;
    const filePath = first?.filePath ?? outDir;
    const astPath = first?.definition.astPath ?? "";
    return err({
      code: "MODULE_EVALUATION_FAILED",
      filePath,
      astPath,
      message: "MISSING_EXPRESSION",
    });
  }

  // Determine import paths from config
  const gqlImportPath = resolveGqlImportPath({ config, outDir });
  const coreImportPath = resolveCoreImportPath({ config, outDir });

  // Build chunk modules
  const chunks = buildChunkModules({ graph, graphIndex, outDir, gqlImportPath, coreImportPath, evaluatorId });

  // Write chunks to disk
  const writeResult = await writeChunkModules({ chunks, outDir });
  return writeResult;
};
