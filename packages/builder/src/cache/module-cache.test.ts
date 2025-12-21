import { describe, expect, it } from "bun:test";
import { createCanonicalId } from "@soda-gql/common";
import { createTestSuite, TestSuite } from "@soda-gql/common/test";
import type { ModuleAnalysis } from "../ast/types";
import { createMemoryCache } from "./memory-cache";
import { ModuleCacheManager } from "./module-cache";

class CacheManagerTestSuite extends TestSuite {
  createAnalysis(overrides: Partial<ModuleAnalysis>): ModuleAnalysis {
    return {
      filePath: "/dev/null",
      signature: "",
      definitions: [],
      imports: [],
      exports: [],
      ...overrides,
    };
  }
}

describe("module cache manager", () => {
  const suite = createTestSuite(CacheManagerTestSuite);

  it("returns cached analysis when file hash matches", () => {
    const factory = createMemoryCache({
      prefix: ["test"],
    });
    const cache = new ModuleCacheManager({
      factory,
      analyzer: "ts",
      evaluatorId: "test",
    });

    const analysis = suite.createAnalysis({
      filePath: "/app/src/entities/user.ts",
      signature: "hash-1",
      definitions: [
        {
          canonicalId: createCanonicalId("/app/src/entities/user.ts", "userModel"),
          astPath: "userModel",
          isTopLevel: true,
          isExported: true,
          exportBinding: "userModel",
          loc: { start: { line: 4, column: 6 }, end: { line: 8, column: 1 } },
          expression: "gql.model('User', () => ({}), (value) => value)",
        },
      ],
    });

    cache.store(analysis);

    const hit = cache.load("/app/src/entities/user.ts", "hash-1");
    expect(hit).toEqual(analysis);
  });

  it("misses cache when hash differs", () => {
    const factory = createMemoryCache({
      prefix: ["test"],
    });
    const cache = new ModuleCacheManager({
      factory,
      analyzer: "ts",
      evaluatorId: "test",
    });

    const analysis = suite.createAnalysis({
      filePath: "/app/src/entities/user.ts",
      signature: "hash-1",
    });

    cache.store(analysis);

    const miss = cache.load("/app/src/entities/user.ts", "hash-2");
    expect(miss).toBeNull();
  });

  it("overwrites cache entries when storing newer analysis", () => {
    const factory = createMemoryCache({
      prefix: ["test"],
    });
    const cache = new ModuleCacheManager({
      factory,
      analyzer: "ts",
      evaluatorId: "test",
    });

    const initial = suite.createAnalysis({
      filePath: "/app/src/entities/user.ts",
      signature: "hash-1",
    });

    const updated = suite.createAnalysis({
      filePath: "/app/src/entities/user.ts",
      signature: "hash-2",
      definitions: [
        {
          canonicalId: createCanonicalId("/app/src/entities/user.ts", "profileQuery"),
          astPath: "profileQuery",
          isTopLevel: true,
          isExported: true,
          exportBinding: "profileQuery",
          loc: { start: { line: 5, column: 6 }, end: { line: 12, column: 1 } },
          expression: "gql.query('ProfilePageQuery', {}, () => ({}))",
        },
      ],
    });

    cache.store(initial);
    cache.store(updated);

    const hit = cache.load("/app/src/entities/user.ts", "hash-2");
    expect(hit).toEqual(updated);
  });
});
