import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { IntermediateArtifactElement, IssueRegistry } from "@soda-gql/core";
import { err, type Result } from "neverthrow";
import type { DependencyGraph } from "../dependency-graph";
import type { GraphIndex } from "../dependency-graph/patcher";
import type { BuilderError } from "../types";
import { analyzeGraph, findWorkspaceRoot } from "./analysis";
import { type WrittenChunkModule, writeChunkModules } from "./chunk-writer";
import { buildIntermediateModuleSource } from "./codegen";
import { emitIntermediateModule } from "./emitter";
import { buildChunkModules } from "./per-chunk-emission";

export type IntermediateModule = {
  readonly elements: Record<string, IntermediateArtifactElement>;
  readonly issueRegistry: IssueRegistry;
};

export type CreateIntermediateModuleInput = {
  readonly graph: DependencyGraph;
  readonly outDir: string;
};

/**
 * DEPRECATED: Legacy single-file emission.
 * Use createIntermediateModuleChunks for new code.
 */
export const createIntermediateModule = async ({
  graph,
  outDir,
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
  const graphqlSystemIndex = join(workspaceRoot, "graphql-system", "index.ts");
  let gqlImportPath = "@/graphql-system";

  if (existsSync(graphqlSystemIndex)) {
    const jsFilePath = join(outDir, "temp.mjs");
    const relativePath = relative(dirname(jsFilePath), graphqlSystemIndex).replace(/\\/g, "/");
    let sanitized = relativePath.length > 0 ? relativePath : "./index.ts";
    if (!sanitized.startsWith(".")) {
      sanitized = `./${sanitized}`;
    }
    gqlImportPath = sanitized.endsWith(".ts") ? sanitized.slice(0, -3) : sanitized;
  }

  // Generate code
  const sourceCode = buildIntermediateModuleSource({ fileGroups, summaries, gqlImportPath });

  // Emit the module
  const emitResult = await emitIntermediateModule({ outDir, sourceCode });

  return emitResult.map(({ transpiledPath }) => ({ transpiledPath, sourceCode }));
};

export type CreateIntermediateModuleChunksInput = {
  readonly graph: DependencyGraph;
  readonly graphIndex: GraphIndex;
  readonly outDir: string;
};

/**
 * Create intermediate modules per chunk (one chunk per source file).
 * Returns a map of chunk ID to written chunk info.
 */
export const createIntermediateModuleChunks = async ({
  graph,
  graphIndex,
  outDir,
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
  const workspaceRoot = findWorkspaceRoot(graph);
  const graphqlSystemIndex = join(workspaceRoot, "graphql-system", "index.ts");
  let gqlImportPath = "@/graphql-system";

  if (existsSync(graphqlSystemIndex)) {
    const jsFilePath = join(outDir, "temp.mjs");
    const relativePath = relative(dirname(jsFilePath), graphqlSystemIndex).replace(/\\/g, "/");
    let sanitized = relativePath.length > 0 ? relativePath : "./index.ts";
    if (!sanitized.startsWith(".")) {
      sanitized = `./${sanitized}`;
    }
    gqlImportPath = sanitized.endsWith(".ts") ? sanitized.slice(0, -3) : sanitized;
  }

  // Build chunk modules
  const chunks = buildChunkModules({ graph, graphIndex, outDir, gqlImportPath });

  // Write chunks to disk
  return await writeChunkModules({ chunks, outDir });
};
