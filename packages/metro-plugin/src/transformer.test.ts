import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __resetUpstreamTransformer, createTransformerWithUpstream } from "./transformer";

describe("transformer", () => {
  describe("createTransformerWithUpstream", () => {
    let testDir: string;
    let mockTransformerPath: string;

    beforeEach(() => {
      __resetUpstreamTransformer();
      testDir = mkdtempSync(join(tmpdir(), "transformer-test-"));
      mockTransformerPath = join(testDir, "mock-transformer.js");

      // Create mock transformer file
      writeFileSync(
        mockTransformerPath,
        `
module.exports = {
  transform: async (params) => ({
    output: [{ data: params.src, type: "js/script" }],
  }),
  getCacheKey: () => "mock-cache-key",
};
`,
      );
    });

    afterEach(() => {
      __resetUpstreamTransformer();
      rmSync(testDir, { recursive: true, force: true });
    });

    test("returns transformer object with correct shape", () => {
      const transformer = createTransformerWithUpstream(mockTransformerPath);

      expect(transformer).toHaveProperty("transform");
      expect(transformer).toHaveProperty("getCacheKey");
      expect(typeof transformer.transform).toBe("function");
      expect(typeof transformer.getCacheKey).toBe("function");
    });

    test("getCacheKey function is callable and returns string", () => {
      const transformer = createTransformerWithUpstream(mockTransformerPath);

      expect(transformer.getCacheKey).toBeDefined();
      const cacheKey = transformer.getCacheKey!();

      expect(typeof cacheKey).toBe("string");
      expect(cacheKey.length).toBeGreaterThan(0);
    });

    test("getCacheKey includes upstream path in hash", () => {
      // Create another mock transformer
      const mockTransformerPath2 = join(testDir, "mock-transformer-2.js");
      writeFileSync(
        mockTransformerPath2,
        `
module.exports = {
  transform: async (params) => ({
    output: [{ data: params.src, type: "js/script" }],
  }),
  getCacheKey: () => "mock-cache-key",
};
`,
      );

      const transformer1 = createTransformerWithUpstream(mockTransformerPath);
      const transformer2 = createTransformerWithUpstream(mockTransformerPath2);

      const key1 = transformer1.getCacheKey!();
      const key2 = transformer2.getCacheKey!();

      // Different upstream paths should produce different cache keys
      expect(key1).not.toBe(key2);
    });

    test("throws error for non-existent upstream path", () => {
      const nonExistentPath = join(testDir, "non-existent-transformer.js");
      const transformer = createTransformerWithUpstream(nonExistentPath);

      // The error is thrown lazily when getCacheKey or transform is called
      expect(() => transformer.getCacheKey!()).toThrow("Upstream transformer not found");
    });

    test("caches upstream transformer on subsequent calls", () => {
      const transformer = createTransformerWithUpstream(mockTransformerPath);

      // Call getCacheKey multiple times
      const key1 = transformer.getCacheKey!();
      const key2 = transformer.getCacheKey!();

      // Should return consistent results (upstream is cached)
      expect(key1).toBe(key2);
    });
  });
});
