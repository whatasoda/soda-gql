import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModuleAnalysis } from "../../../packages/builder/src/ast/analyze-module";
import { createModuleCache } from "../../../packages/builder/src/cache";

describe("module cache manager", () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "builder-cache-"));
  });

  const createAnalysis = (overrides: Partial<ModuleAnalysis>): ModuleAnalysis => ({
    filePath: "/dev/null",
    sourceHash: "",
    definitions: [],
    diagnostics: [],
    imports: [],
    exports: [],
    ...overrides,
  });

  it("returns cached analysis when file hash matches", () => {
    const cache = createModuleCache({ rootDir: cacheDir });
    const analysis = createAnalysis({
      filePath: "/app/src/entities/user.ts",
      sourceHash: "hash-1",
      definitions: [
        {
          kind: "model",
          exportName: "userModel",
          loc: { start: { line: 4, column: 6 }, end: { line: 8, column: 1 } },
          references: [],
          expression: "gql.model('User', () => ({}), (value) => value)",
        },
      ],
    });

    cache.store(analysis);

    const hit = cache.load("/app/src/entities/user.ts", "hash-1");
    expect(hit).toEqual(analysis);
  });

  it("misses cache when hash differs", () => {
    const cache = createModuleCache({ rootDir: cacheDir });
    const analysis = createAnalysis({
      filePath: "/app/src/entities/user.ts",
      sourceHash: "hash-1",
    });

    cache.store(analysis);

    const miss = cache.load("/app/src/entities/user.ts", "hash-2");
    expect(miss).toBeNull();
  });

  it("overwrites cache entries when storing newer analysis", () => {
    const cache = createModuleCache({ rootDir: cacheDir });
    const initial = createAnalysis({
      filePath: "/app/src/entities/user.ts",
      sourceHash: "hash-1",
    });

    const updated = createAnalysis({
      filePath: "/app/src/entities/user.ts",
      sourceHash: "hash-2",
      definitions: [
        {
          kind: "operation",
          exportName: "profileQuery",
          loc: { start: { line: 5, column: 6 }, end: { line: 12, column: 1 } },
          references: [],
          expression: "gql.query('ProfilePageQuery', {}, () => ({}))",
        },
      ],
    });

    cache.store(initial);
    cache.store(updated);

    const hit = cache.load("/app/src/entities/user.ts", "hash-2");
    expect(hit).toEqual(updated);
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });
});
