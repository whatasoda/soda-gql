import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanonicalId } from "@soda-gql/builder/canonical-id/canonical-id";
import { type ChunkModule, writeChunkModules } from "@soda-gql/builder/intermediate-module/chunk-writer";

const createTestChunk = (chunkId: string, sourcePath: string, sourceCode: string): ChunkModule => {
  return {
    chunkId,
    sourcePath,
    outputPath: "",
    contentHash: "test-hash",
    canonicalIds: [createCanonicalId(sourcePath, "default")],
    imports: [],
    sourceCode,
  };
};

describe("writeChunkModules", () => {
  test("should write single chunk to disk", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "chunk-writer-test-"));

    try {
      const chunks = new Map<string, ChunkModule>([
        ["/src/a.ts", createTestChunk("/src/a.ts", "/src/a.ts", "export const foo = 'bar';")],
      ]);

      const result = await writeChunkModules({ chunks, outDir: tmpDir });

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const written = result.value;
        expect(written.size).toBe(1);

        const chunkResult = written.get("/src/a.ts");
        expect(chunkResult).toBeDefined();
        expect(chunkResult?.transpiledPath).toContain(tmpDir);

        // Verify file was written
        if (chunkResult?.transpiledPath) {
          const content = readFileSync(chunkResult.transpiledPath, "utf-8");
          expect(content).toContain("foo");
        }
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("should write multiple chunks to disk", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "chunk-writer-test-"));

    try {
      const chunks = new Map<string, ChunkModule>([
        ["/src/a.ts", createTestChunk("/src/a.ts", "/src/a.ts", "export const foo = 'a';")],
        ["/src/b.ts", createTestChunk("/src/b.ts", "/src/b.ts", "export const bar = 'b';")],
      ]);

      const result = await writeChunkModules({ chunks, outDir: tmpDir });

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const written = result.value;
        expect(written.size).toBe(2);
        expect(written.has("/src/a.ts")).toBe(true);
        expect(written.has("/src/b.ts")).toBe(true);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("should return error on write failure", async () => {
    const chunks = new Map<string, ChunkModule>([
      ["/src/a.ts", createTestChunk("/src/a.ts", "/src/a.ts", "export const foo = 'bar';")],
    ]);

    // Use invalid directory path
    const result = await writeChunkModules({ chunks, outDir: "/invalid/path/that/does/not/exist" });

    expect(result.isErr()).toBe(true);
  });

  test("should transpile TypeScript to JavaScript", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "chunk-writer-test-"));

    try {
      const chunks = new Map<string, ChunkModule>([
        ["/src/a.ts", createTestChunk("/src/a.ts", "/src/a.ts", "const foo: string = 'bar'; export { foo };")],
      ]);

      const result = await writeChunkModules({ chunks, outDir: tmpDir });

      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        const written = result.value;
        const chunkResult = written.get("/src/a.ts");

        if (chunkResult?.transpiledPath) {
          const content = readFileSync(chunkResult.transpiledPath, "utf-8");
          // TypeScript types should be stripped
          expect(content).not.toContain(": string");
          expect(content).toContain("foo");
        }
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
