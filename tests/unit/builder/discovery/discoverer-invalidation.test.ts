import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAstAnalyzer } from "@soda-gql/builder/ast";
import { createJsonCache } from "@soda-gql/builder/cache/json-cache";
import { createDiscoveryCache } from "@soda-gql/builder/discovery/cache";
import { discoverModules } from "@soda-gql/builder/discovery/discoverer";

const fixtureRoot = join(import.meta.dir, "..", "..", "..", "fixtures", "builder", "discoverer-invalidation");
const cacheFactory = createJsonCache({ rootDir: join(fixtureRoot, ".cache") });

describe("discoverModules - invalidatedPaths behavior", () => {
  test("cacheSkips equals invalidatedPaths.size when all invalidated files exist", () => {
    // Setup: Create temporary fixture files
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });

    const fileA = join(fixtureRoot, "a.ts");
    const fileB = join(fixtureRoot, "b.ts");
    const fileC = join(fixtureRoot, "c.ts");

    writeFileSync(fileA, `import { b } from "./b";\nexport const a = 1;`);
    writeFileSync(fileB, `import { c } from "./c";\nexport const b = 2;`);
    writeFileSync(fileC, `export const c = 3;`);

    const astAnalyzer = getAstAnalyzer("ts");
    const cache = createDiscoveryCache({
      factory: cacheFactory,
      analyzer: "test-analyzer",
      evaluatorId: "test-evaluator",
    });

    // First discovery: populate cache
    const result1 = discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      cache,
    });
    if (result1.isErr()) throw result1.error;

    expect(result1.value.cacheHits).toBe(0);
    expect(result1.value.cacheMisses).toBe(3); // a, b, c
    expect(result1.value.cacheSkips).toBe(0);

    // Second discovery: with 2 files invalidated
    const invalidatedPaths = new Set([fileA, fileB]);
    const result2 = discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      cache,
      invalidatedPaths,
    });
    if (result2.isErr()) throw result2.error;

    expect(result2.value.cacheSkips).toBe(2); // fileA and fileB invalidated
    expect(result2.value.cacheHits).toBe(1); // fileC reused from cache
    expect(result2.value.cacheMisses).toBe(2); // fileA and fileB re-read

    // Cleanup
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test("cacheSkips handles invalidatedPaths with non-entry files", () => {
    // Setup
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });

    const fileA = join(fixtureRoot, "a.ts");
    const fileB = join(fixtureRoot, "b.ts");

    writeFileSync(fileA, `import { b } from "./b";\nexport const a = 1;`);
    writeFileSync(fileB, `export const b = 2;`);

    const astAnalyzer = getAstAnalyzer("ts");
    const cache = createDiscoveryCache({
      factory: cacheFactory,
      analyzer: "test-analyzer",
      evaluatorId: "test-evaluator",
    });

    // First discovery
    discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      cache,
    });

    // Second discovery: invalidate only dependency (fileB)
    const invalidatedPaths = new Set([fileB]);
    const result = discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      cache,
      invalidatedPaths,
    });
    if (result.isErr()) throw result.error;

    expect(result.value.cacheSkips).toBe(1); // Only fileB
    expect(result.value.cacheHits).toBe(1); // fileA reused

    // Cleanup
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test("cacheSkips is 0 when invalidatedPaths is empty", () => {
    // Setup
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });

    const fileA = join(fixtureRoot, "a.ts");
    writeFileSync(fileA, `export const a = 1;`);

    const astAnalyzer = getAstAnalyzer("ts");
    const cache = createDiscoveryCache({
      factory: cacheFactory,
      analyzer: "test-analyzer",
      evaluatorId: "test-evaluator",
    });

    // First discovery
    discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      cache,
    });

    // Second discovery: no invalidations
    const result = discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      cache,
      invalidatedPaths: new Set(),
    });
    if (result.isErr()) throw result.error;

    expect(result.value.cacheSkips).toBe(0);
    expect(result.value.cacheHits).toBe(1);
    expect(result.value.cacheMisses).toBe(0);

    // Cleanup
    rmSync(fixtureRoot, { recursive: true, force: true });
  });
});
