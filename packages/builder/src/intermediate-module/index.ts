import { err, type Result } from "neverthrow";
import type { DependencyGraph } from "../dependency-graph";
import type { GraphIndex } from "../dependency-graph/patcher";
import type { BuilderError } from "../types";
import { analyzeGraph, findWorkspaceRoot } from "./analysis";
import { type WrittenChunkModule, writeChunkModules } from "./chunk-writer";
import { buildIntermediateModuleSource } from "./codegen";
import { emitIntermediateModule } from "./emitter";
import { resolveGqlImportPath } from "./gql-import";
import { buildChunkModules } from "./per-chunk-emission";

export type CreateIntermediateModuleInput = {
  readonly graph: DependencyGraph;
  readonly outDir: string;
  readonly evaluatorId: string;
};

/**
 * DEPRECATED: Legacy single-file emission.
 * Use createIntermediateModuleChunks for new code.
 */
export const createIntermediateModule = async ({
  graph,
  outDir,
  evaluatorId,
}: CreateIntermediateModuleInput): Promise<Result<{ transpiledPath: string; sourceCode: string }, BuilderError>> => {
  // Analyze the graph
  const { fileGroups, summaries, missingExpressions, workspaceRoot } = analyzeGraph(graph);

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

  // Determine gqlImportPath
  const gqlImportPath = resolveGqlImportPath({ graph, outDir });

  // Generate code
  const sourceCode = buildIntermediateModuleSource({ fileGroups, summaries, gqlImportPath, evaluatorId });

  // Emit the module
  const emitResult = await emitIntermediateModule({ outDir, sourceCode });

  return emitResult.map(({ transpiledPath }) => ({ transpiledPath, sourceCode }));
};

export type CreateIntermediateModuleChunksInput = {
  readonly graph: DependencyGraph;
  readonly graphIndex: GraphIndex;
  readonly outDir: string;
  readonly evaluatorId: string;
};

/**
 * Create intermediate modules per chunk (one chunk per source file).
 * Returns a map of chunk ID to written chunk info.
 */
export const createIntermediateModuleChunks = async ({
  graph,
  graphIndex,
  outDir,
  evaluatorId,
}: CreateIntermediateModuleChunksInput): Promise<Result<Map<string, WrittenChunkModule>, BuilderError>> => {
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

  // Determine gqlImportPath
  const gqlImportPath = resolveGqlImportPath({ graph, outDir });

  // Build chunk modules
  const chunks = buildChunkModules({ graph, graphIndex, outDir, gqlImportPath, evaluatorId });

  // Write chunks to disk
  return await writeChunkModules({ chunks, outDir });
};
