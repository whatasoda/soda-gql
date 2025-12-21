import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getTestConfig } from "../../test/codegen-fixture/get-config";
import { createAstAnalyzer } from "../ast";
import { createMemoryCache } from "../cache/memory-cache";
import { createGraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import { createDiscoveryCache } from "./cache";
import { discoverModules, discoverModulesAsync } from "./discoverer";
import { clearFingerprintCache } from "./fingerprint";

const fixtureRoot = join(process.cwd(), ".cache", "test", "discoverer-invalidation");

const makeCache = () =>
  createDiscoveryCache({
    factory: createMemoryCache(),
    analyzer: "test-analyzer",
    evaluatorId: "test-evaluator",
  });

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

    const testConfig = getTestConfig();
    const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
    const astAnalyzer = createAstAnalyzer({ analyzer: "ts", graphqlHelper });
    const cache = makeCache();
    clearFingerprintCache();

    // First discovery: populate cache
    const result1 = discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set(),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });
    if (result1.isErr()) throw result1.error;

    expect(result1.value.cacheHits).toBe(0);
    expect(result1.value.cacheMisses).toBe(3); // a, b, c
    expect(result1.value.cacheSkips).toBe(0);

    // Second discovery: with 2 files invalidated
    const result2 = discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set([fileA, fileB]),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
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

    const testConfig = getTestConfig();
    const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
    const astAnalyzer = createAstAnalyzer({ analyzer: "ts", graphqlHelper });
    const cache = makeCache();
    clearFingerprintCache();

    // First discovery
    discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set(),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });

    // Second discovery: invalidate only dependency (fileB)
    const result = discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set([fileB]),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
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

    const testConfig = getTestConfig();
    const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
    const astAnalyzer = createAstAnalyzer({ analyzer: "ts", graphqlHelper });
    const cache = makeCache();
    clearFingerprintCache();

    // First discovery
    discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set(),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });

    // Second discovery: no invalidations
    const result = discoverModules({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set(),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });
    if (result.isErr()) throw result.error;

    expect(result.value.cacheSkips).toBe(0);
    expect(result.value.cacheHits).toBe(1);
    expect(result.value.cacheMisses).toBe(0);

    // Cleanup
    rmSync(fixtureRoot, { recursive: true, force: true });
  });
});

describe("discoverModulesAsync - invalidatedPaths behavior", () => {
  test("cacheSkips equals invalidatedPaths.size when all invalidated files exist", async () => {
    // Setup: Create temporary fixture files
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });

    const fileA = join(fixtureRoot, "a.ts");
    const fileB = join(fixtureRoot, "b.ts");
    const fileC = join(fixtureRoot, "c.ts");

    writeFileSync(fileA, `import { b } from "./b";\nexport const a = 1;`);
    writeFileSync(fileB, `import { c } from "./c";\nexport const b = 2;`);
    writeFileSync(fileC, `export const c = 3;`);

    const testConfig = getTestConfig();
    const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
    const astAnalyzer = createAstAnalyzer({ analyzer: "ts", graphqlHelper });
    const cache = makeCache();
    clearFingerprintCache();

    // First discovery: populate cache
    const result1 = await discoverModulesAsync({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set(),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });
    if (result1.isErr()) throw result1.error;

    expect(result1.value.cacheHits).toBe(0);
    expect(result1.value.cacheMisses).toBe(3); // a, b, c
    expect(result1.value.cacheSkips).toBe(0);

    // Second discovery: with 2 files invalidated
    const result2 = await discoverModulesAsync({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set([fileA, fileB]),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });
    if (result2.isErr()) throw result2.error;

    expect(result2.value.cacheSkips).toBe(2); // fileA and fileB invalidated
    expect(result2.value.cacheHits).toBe(1); // fileC reused from cache
    expect(result2.value.cacheMisses).toBe(2); // fileA and fileB re-read

    // Cleanup
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test("cacheSkips handles invalidatedPaths with non-entry files", async () => {
    // Setup
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });

    const fileA = join(fixtureRoot, "a.ts");
    const fileB = join(fixtureRoot, "b.ts");

    writeFileSync(fileA, `import { b } from "./b";\nexport const a = 1;`);
    writeFileSync(fileB, `export const b = 2;`);

    const testConfig = getTestConfig();
    const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
    const astAnalyzer = createAstAnalyzer({ analyzer: "ts", graphqlHelper });
    const cache = makeCache();
    clearFingerprintCache();

    // First discovery
    await discoverModulesAsync({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set(),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });

    // Second discovery: invalidate only dependency (fileB)
    const result = await discoverModulesAsync({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set([fileB]),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });
    if (result.isErr()) throw result.error;

    expect(result.value.cacheSkips).toBe(1); // Only fileB
    expect(result.value.cacheHits).toBe(1); // fileA reused

    // Cleanup
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test("cacheSkips is 0 when invalidatedPaths is empty", async () => {
    // Setup
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });

    const fileA = join(fixtureRoot, "a.ts");
    writeFileSync(fileA, `export const a = 1;`);

    const testConfig = getTestConfig();
    const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
    const astAnalyzer = createAstAnalyzer({ analyzer: "ts", graphqlHelper });
    const cache = makeCache();
    clearFingerprintCache();

    // First discovery
    await discoverModulesAsync({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set(),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });

    // Second discovery: no invalidations
    const result = await discoverModulesAsync({
      entryPaths: [fileA],
      astAnalyzer,
      incremental: {
        cache,
        changedFiles: new Set(),
        removedFiles: new Set(),
        affectedFiles: new Set(),
      },
    });
    if (result.isErr()) throw result.error;

    expect(result.value.cacheSkips).toBe(0);
    expect(result.value.cacheHits).toBe(1);
    expect(result.value.cacheMisses).toBe(0);

    // Cleanup
    rmSync(fixtureRoot, { recursive: true, force: true });
  });
});
