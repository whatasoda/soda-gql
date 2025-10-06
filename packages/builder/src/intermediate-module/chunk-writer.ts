import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getPortableFS } from "@soda-gql/common";
import { transformSync } from "@swc/core";
import { err, ok, type Result } from "neverthrow";
import type { BuilderError } from "../types";

export type ChunkModule = {
  readonly chunkId: string;
  readonly sourcePath: string;
  readonly outputPath: string;
  readonly contentHash: string;
  readonly canonicalIds: readonly string[];
  readonly imports: readonly string[];
  readonly sourceCode: string;
};

export type WrittenChunkModule = {
  readonly chunkId: string;
  readonly transpiledPath: string;
  readonly contentHash: string;
};

export type WriteChunkModulesInput = {
  readonly chunks: Map<string, ChunkModule>;
  readonly outDir: string;
};

/**
 * Write chunk modules to disk, transpiling TypeScript to JavaScript.
 */
export const writeChunkModules = async ({
  chunks,
  outDir,
}: WriteChunkModulesInput): Promise<Result<Map<string, WrittenChunkModule>, BuilderError>> => {
  // Create output directory
  try {
    mkdirSync(outDir, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "WRITE_FAILED",
      message,
      outPath: outDir,
    });
  }

  const written = new Map<string, WrittenChunkModule>();

  for (const [chunkId, chunk] of chunks.entries()) {
    const { sourceCode, contentHash } = chunk;

    // Generate unique filename based on content hash
    const fileName = `${contentHash}.mjs`;
    const jsFilePath = join(outDir, fileName);

    // Transpile TypeScript to JavaScript using SWC
    let transpiledCode: string;
    try {
      const result = transformSync(sourceCode, {
        filename: `${contentHash}.ts`,
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: false,
          },
          target: "es2022",
        },
        module: {
          type: "es6",
        },
        sourceMaps: false,
        minify: false,
      });
      transpiledCode = result.code;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err({
        code: "MODULE_EVALUATION_FAILED",
        filePath: jsFilePath,
        astPath: "",
        message: `SWC transpilation failed: ${message}`,
      });
    }

    // Write transpiled code to disk
    try {
      const fs = getPortableFS();
      await fs.writeFile(jsFilePath, transpiledCode);
      written.set(chunkId, {
        chunkId,
        transpiledPath: jsFilePath,
        contentHash,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err({
        code: "WRITE_FAILED",
        message,
        outPath: jsFilePath,
      });
    }
  }

  return ok(written);
};
