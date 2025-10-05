import { createHash } from "node:crypto";
import { join } from "node:path";
import type { CanonicalId } from "../canonical-id";
import type { DependencyGraph } from "../dependency-graph";
import type { GraphIndex } from "../dependency-graph/patcher";
import { getModuleSummaries, groupNodesByFile } from "./analysis";
import { buildIntermediateModuleSource, type IntermediateModuleSourceInput } from "./codegen";

export type ChunkModule = {
  readonly chunkId: string;
  readonly sourcePath: string;
  readonly outputPath: string;
  readonly contentHash: string;
  readonly canonicalIds: readonly CanonicalId[];
  readonly imports: readonly string[];
  readonly sourceCode: string;
};

export type BuildChunkModulesInput = {
  readonly graph: DependencyGraph;
  readonly graphIndex: GraphIndex;
  readonly outDir: string;
  readonly gqlImportPath: string;
  readonly evaluatorId: string;
};

/**
 * Compute a stable content hash for chunk source code.
 */
const computeContentHash = (sourceCode: string): string => {
  return createHash("sha256").update(sourceCode).digest("hex").slice(0, 16);
};

/**
 * Extract chunk imports from a set of nodes.
 * Returns file paths of dependencies, excluding self-imports.
 */
const extractChunkImports = (filePath: string, nodeIds: Set<CanonicalId>, graph: DependencyGraph): string[] => {
  const importedFiles = new Set<string>();

  for (const nodeId of nodeIds) {
    const node = graph.get(nodeId);
    if (!node) continue;

    for (const depId of node.dependencies) {
      const depNode = graph.get(depId);
      if (!depNode) continue;

      // Skip self-imports
      if (depNode.filePath === filePath) continue;

      importedFiles.add(depNode.filePath);
    }
  }

  return Array.from(importedFiles).sort();
};

/**
 * Build chunk modules from dependency graph.
 * Each chunk corresponds to one source file.
 */
export const buildChunkModules = ({
  graph,
  graphIndex: _graphIndex,
  outDir,
  gqlImportPath,
  evaluatorId,
}: BuildChunkModulesInput): Map<string, ChunkModule> => {
  const chunks = new Map<string, ChunkModule>();
  const summaries = getModuleSummaries(graph);
  const fileGroups = groupNodesByFile(graph);

  for (const fileGroup of fileGroups) {
    const { filePath, nodes } = fileGroup;

    // Get canonical IDs for this chunk
    const canonicalIds = nodes.map((node) => node.id);

    // Extract chunk imports
    const nodeIdSet = new Set(canonicalIds);
    const imports = extractChunkImports(filePath, nodeIdSet, graph);

    // Generate source code for this chunk
    const sourceCode = buildIntermediateModuleSource({
      fileGroups: [fileGroup],
      summaries,
      gqlImportPath,
      evaluatorId,
    } satisfies IntermediateModuleSourceInput);

    // Compute content hash
    const contentHash = computeContentHash(sourceCode);

    // Generate output path
    const chunkId = filePath;
    const fileName = `${contentHash}.mjs`;
    const outputPath = join(outDir, fileName);

    chunks.set(chunkId, {
      chunkId,
      sourcePath: filePath,
      outputPath,
      contentHash,
      canonicalIds,
      imports,
      sourceCode,
    });
  }

  return chunks;
};
