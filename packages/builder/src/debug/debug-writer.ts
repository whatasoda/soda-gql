import { mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { getPortableFS } from "@soda-gql/common";
import type { BuilderArtifact } from "../artifact/types";
import type { ModuleAnalysis } from "../ast";
import type { DependencyGraph } from "../dependency-graph";
import type { WrittenChunkModule } from "../internal/intermediate-module/chunk-writer";
import type { ChunkManifest } from "../internal/intermediate-module/chunks";

type LegacyIntermediateModulePayload = {
  readonly sourceCode: string;
  readonly transpiledPath: string;
};

type ChunkIntermediateModulePayload = {
  readonly manifest: ChunkManifest;
  readonly chunks: Map<string, WrittenChunkModule>;
  readonly stats?: {
    readonly written: number;
    readonly skipped: number;
  };
};

const sanitizeChunkBaseName = (chunkId: string): string => {
  const base = basename(chunkId).replace(/\.[^.]+$/, "");
  const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, "_");
  return sanitized.length > 0 ? sanitized : "chunk";
};

const formatChunkFileName = (chunkId: string, index: number, contentHash: string): string => {
  const counter = index.toString().padStart(3, "0");
  const safeBase = sanitizeChunkBaseName(chunkId);
  return `${counter}_${safeBase}_${contentHash}.mjs`;
};

export type DebugWriter = {
  writeDiscoverySnapshot(modules: readonly ModuleAnalysis[], graph: DependencyGraph): Promise<void>;
  writeIntermediateModule(input: LegacyIntermediateModulePayload | ChunkIntermediateModulePayload): Promise<void>;
  writeArtifact(artifact: BuilderArtifact): Promise<void>;
};

const createNoOpWriter = (): DebugWriter => ({
  writeDiscoverySnapshot: async () => {},
  writeIntermediateModule: async () => {},
  writeArtifact: async () => {},
});

const createRealWriter = (debugDir: string): DebugWriter => {
  const debugPath = resolve(debugDir);
  mkdirSync(debugPath, { recursive: true });
  const fs = getPortableFS();

  return {
    async writeDiscoverySnapshot(modules: readonly ModuleAnalysis[], graph: DependencyGraph): Promise<void> {
      await fs.writeFile(resolve(debugPath, "modules.json"), JSON.stringify(modules, null, 2));
      await fs.writeFile(resolve(debugPath, "graph.json"), JSON.stringify(Array.from(graph.entries()), null, 2));
    },

    async writeIntermediateModule(input: LegacyIntermediateModulePayload | ChunkIntermediateModulePayload): Promise<void> {
      if ("sourceCode" in input && "transpiledPath" in input) {
        await fs.writeFile(resolve(debugPath, "intermediate-module.ts"), input.sourceCode);
        const transpiledContent = await fs.readFile(input.transpiledPath);
        await fs.writeFile(resolve(debugPath, "intermediate-module.mjs"), transpiledContent);
        return;
      }

      const { manifest, chunks, stats } = input;
      const debugFileMap = new Map<string, string>();

      if (chunks.size > 0) {
        const chunkDir = resolve(debugPath, "chunks");
        mkdirSync(chunkDir, { recursive: true });

        let index = 0;
        for (const [chunkId, chunk] of chunks.entries()) {
          index += 1;
          const fileName = formatChunkFileName(chunkId, index, chunk.contentHash);
          const debugFilePath = resolve(chunkDir, fileName);
          const transpiledContent = await fs.readFile(chunk.transpiledPath);
          await fs.writeFile(debugFilePath, transpiledContent);
          debugFileMap.set(chunkId, `chunks/${fileName}`);
        }
      }

      const manifestPayload = {
        version: manifest.version,
        chunks: Array.from(manifest.chunks.entries()).map(([chunkId, info]) => ({
          id: chunkId,
          sourcePath: info.sourcePath,
          outputPath: info.outputPath,
          contentHash: info.contentHash,
          canonicalIds: info.canonicalIds,
          imports: info.imports,
          debugFile: debugFileMap.get(chunkId) ?? null,
        })),
        emitted: Array.from(chunks.entries()).map(([chunkId, chunk]) => ({
          id: chunkId,
          transpiledPath: chunk.transpiledPath,
          contentHash: chunk.contentHash,
          debugFile: debugFileMap.get(chunkId) ?? null,
        })),
        stats: stats ?? { written: chunks.size, skipped: 0 },
      };

      await fs.writeFile(resolve(debugPath, "intermediate-chunks.json"), JSON.stringify(manifestPayload, null, 2));
    },

    async writeArtifact(artifact: BuilderArtifact): Promise<void> {
      await fs.writeFile(resolve(debugPath, "artifact.json"), JSON.stringify(artifact, null, 2));
    },
  };
};

/**
 * Create a debug writer helper.
 * Returns a no-op writer when debugDir is falsy, otherwise returns a real writer.
 */
export const createDebugWriter = (debugDir?: string): DebugWriter => {
  return debugDir ? createRealWriter(debugDir) : createNoOpWriter();
};
