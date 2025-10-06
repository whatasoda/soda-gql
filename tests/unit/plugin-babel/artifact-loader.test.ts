import { describe, expect, it } from "bun:test";
import { getPortableFS, getPortableHasher } from "@soda-gql/common";
import { TestSuite } from "../../utils/base";
import { createBuilderArtifact } from "../../utils/artifact-fixtures";
import { type CanonicalId, createCanonicalId } from "@soda-gql/builder";

/**
 * Test suite for portable artifact loading
 * Validates that artifact.ts uses portable FS/hasher APIs
 */
class ArtifactLoaderTests extends TestSuite {
  setup() {
    super.setup();
  }

  async createTestArtifact(filename: string) {
    const canonicalId = createCanonicalId("/test/file.ts", "operation") as CanonicalId;
    const artifact = createBuilderArtifact([
      [
        canonicalId,
        {
          id: canonicalId,
          type: "operation",
          prebuild: {
            operationType: "query",
            operationName: "TestQuery",
            document: { kind: "Document", definitions: [] },
            variableNames: [],
            projectionPathGraph: {},
          },
        } as any,
      ],
    ]);

    const artifactPath = await this.writeTempFile(filename, JSON.stringify(artifact));
    return { artifact, artifactPath };
  }
}

const suite = new ArtifactLoaderTests();
suite.setup();

describe("loadArtifact (portable)", () => {
  it("should load valid artifact file using portable FS", async () => {
    const { loadArtifact } = await import("@soda-gql/plugin-babel/internal/artifact");
    const { artifactPath } = await suite.createTestArtifact("valid.json");

    const result = await loadArtifact(artifactPath);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.elements).toBeDefined();
      expect(result.value.report).toBeDefined();
    }
  });

  it("should return error for non-existent file using portable FS", async () => {
    const { loadArtifact } = await import("@soda-gql/plugin-babel/internal/artifact");
    const nonExistentPath = suite.getTempPath("nonexistent.json");

    const result = await loadArtifact(nonExistentPath);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.path).toBe(nonExistentPath);
    }
  });

  it("should return error for malformed JSON using portable FS", async () => {
    const { loadArtifact } = await import("@soda-gql/plugin-babel/internal/artifact");
    const malformedPath = await suite.writeTempFile("malformed.json", "{ invalid json");

    const result = await loadArtifact(malformedPath);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("PARSE_FAILED");
    }
  });

  it("should return error for invalid artifact schema", async () => {
    const { loadArtifact } = await import("@soda-gql/plugin-babel/internal/artifact");
    const invalidPath = await suite.writeTempFile("invalid.json", JSON.stringify({ wrong: "schema" }));

    const result = await loadArtifact(invalidPath);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });
});

describe("Artifact memoization", () => {
  it("should return same instance on repeated calls with unchanged file", async () => {
    const { loadArtifact, invalidateArtifactCache } = await import("@soda-gql/plugin-babel/internal/artifact");
    const { artifactPath } = await suite.createTestArtifact("memo-test.json");

    // Clear cache first
    invalidateArtifactCache();

    const result1 = await loadArtifact(artifactPath);
    const result2 = await loadArtifact(artifactPath);

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);

    if (result1.isOk() && result2.isOk()) {
      // Should be same instance (reference equality)
      expect(result2.value).toBe(result1.value);
    }
  });

  it("should invalidate cache when file content changes", async () => {
    const { loadArtifact, invalidateArtifactCache } = await import("@soda-gql/plugin-babel/internal/artifact");
    const artifactPath = suite.getTempPath("change-test.json");

    // Clear cache first
    invalidateArtifactCache();

    // Write initial artifact
    const fs = getPortableFS();
    const canonicalId1 = createCanonicalId("/test/v1.ts", "op1") as CanonicalId;
    const artifact1 = createBuilderArtifact([
      [
        canonicalId1,
        {
          id: canonicalId1,
          type: "operation",
          prebuild: {
            operationType: "query",
            operationName: "Query1",
            document: { kind: "Document", definitions: [] },
            variableNames: [],
            projectionPathGraph: {},
          },
        } as any,
      ],
    ]);
    await fs.writeFile(artifactPath, JSON.stringify(artifact1));

    const result1 = await loadArtifact(artifactPath);

    // Small delay to ensure mtime changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Modify the file
    const canonicalId2 = createCanonicalId("/test/v2.ts", "op2") as CanonicalId;
    const artifact2 = createBuilderArtifact([
      [
        canonicalId2,
        {
          id: canonicalId2,
          type: "operation",
          prebuild: {
            operationType: "query",
            operationName: "Query2",
            document: { kind: "Document", definitions: [] },
            variableNames: [],
            projectionPathGraph: {},
          },
        } as any,
      ],
    ]);
    await fs.writeFile(artifactPath, JSON.stringify(artifact2));

    const result2 = await loadArtifact(artifactPath);

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);

    if (result1.isOk() && result2.isOk()) {
      // Content should differ
      const ids1 = Object.keys(result1.value.elements);
      const ids2 = Object.keys(result2.value.elements);
      expect(ids1).not.toEqual(ids2);
      // Should be different instances
      expect(result2.value).not.toBe(result1.value);
    }
  });

  it("should manually invalidate cache for specific path", async () => {
    const { loadArtifact, invalidateArtifactCache } = await import("@soda-gql/plugin-babel/internal/artifact");
    const { artifactPath } = await suite.createTestArtifact("invalidate-test.json");

    // Clear cache first
    invalidateArtifactCache();

    const result1 = await loadArtifact(artifactPath);

    // Manually invalidate this specific path
    invalidateArtifactCache(artifactPath);

    const result2 = await loadArtifact(artifactPath);

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);

    if (result1.isOk() && result2.isOk()) {
      // Should be different instances after invalidation
      expect(result2.value).not.toBe(result1.value);
    }
  });

  it("should clear all caches when called without path", async () => {
    const { loadArtifact, invalidateArtifactCache, getArtifactCacheStats } = await import(
      "@soda-gql/plugin-babel/internal/artifact"
    );

    // Clear cache first
    invalidateArtifactCache();

    const { artifactPath: path1 } = await suite.createTestArtifact("cache-stats-1.json");
    const { artifactPath: path2 } = await suite.createTestArtifact("cache-stats-2.json");

    await loadArtifact(path1);
    await loadArtifact(path2);

    const statsBefore = getArtifactCacheStats();
    expect(statsBefore.size).toBe(2);

    // Clear all caches
    invalidateArtifactCache();

    const statsAfter = getArtifactCacheStats();
    expect(statsAfter.size).toBe(0);
  });

  it("should include schema hash in cache key", async () => {
    const { loadArtifact, invalidateArtifactCache } = await import("@soda-gql/plugin-babel/internal/artifact");
    const { artifactPath } = await suite.createTestArtifact("schema-hash-test.json");

    // Clear cache first
    invalidateArtifactCache();

    const result1 = await loadArtifact(artifactPath, { schemaHash: "schema-v1" });
    const result2 = await loadArtifact(artifactPath, { schemaHash: "schema-v2" });

    expect(result1.isOk()).toBe(true);
    expect(result2.isOk()).toBe(true);

    if (result1.isOk() && result2.isOk()) {
      // Different schema hash should force reload, but content is same
      expect(result2.value).not.toBe(result1.value);
    }
  });
});
