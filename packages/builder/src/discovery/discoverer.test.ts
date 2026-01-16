import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getTestConfig } from "../../test/fixture-catalog/get-config";
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

describe("discoverModules - JS file handling", () => {
  test("JS files are discovered with empty analysis when imported via .js specifier", () => {
    // Setup: Create a TS file that imports a .js file (no .ts equivalent exists)
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });

    const mainTs = join(fixtureRoot, "main.ts");
    const helperJs = join(fixtureRoot, "helper.js");

    // main.ts imports helper.js (ESM style) but only helper.js exists, no helper.ts
    writeFileSync(mainTs, `import { helper } from "./helper.js";\nexport const main = helper;`);
    writeFileSync(helperJs, `export const helper = 1;`);

    const testConfig = getTestConfig();
    const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
    const astAnalyzer = createAstAnalyzer({ analyzer: "ts", graphqlHelper });
    clearFingerprintCache();

    const result = discoverModules({
      entryPaths: [mainTs],
      astAnalyzer,
    });
    if (result.isErr()) throw result.error;

    // Should discover both files
    expect(result.value.snapshots).toHaveLength(2);

    // Find the JS file snapshot
    const jsSnapshot = result.value.snapshots.find((s) => s.filePath.endsWith("helper.js"));
    expect(jsSnapshot).toBeDefined();

    // JS file should have empty analysis (no definitions, imports, exports)
    expect(jsSnapshot!.analysis.definitions).toHaveLength(0);
    expect(jsSnapshot!.analysis.imports).toHaveLength(0);
    expect(jsSnapshot!.analysis.exports).toHaveLength(0);
    expect(jsSnapshot!.analysis.diagnostics).toHaveLength(0);

    // Cleanup
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test("TS files are preferred over JS files when both exist", () => {
    // Setup: Create both .ts and .js files
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });

    const mainTs = join(fixtureRoot, "main.ts");
    const helperTs = join(fixtureRoot, "helper.ts");
    const helperJs = join(fixtureRoot, "helper.js");

    // main.ts imports helper.js but helper.ts exists, so it should resolve to helper.ts
    writeFileSync(mainTs, `import { helper } from "./helper.js";\nexport const main = helper;`);
    writeFileSync(helperTs, `export const helper = 1;`);
    writeFileSync(helperJs, `module.exports = { helper: 1 };`);

    const testConfig = getTestConfig();
    const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
    const astAnalyzer = createAstAnalyzer({ analyzer: "ts", graphqlHelper });
    clearFingerprintCache();

    const result = discoverModules({
      entryPaths: [mainTs],
      astAnalyzer,
    });
    if (result.isErr()) throw result.error;

    // Should discover 2 files: main.ts and helper.ts (not helper.js)
    expect(result.value.snapshots).toHaveLength(2);

    const filePaths = result.value.snapshots.map((s) => s.filePath);
    expect(filePaths.some((p) => p.endsWith("helper.ts"))).toBe(true);
    expect(filePaths.some((p) => p.endsWith("helper.js"))).toBe(false);

    // Cleanup
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test("MJS files are discovered with empty analysis", () => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });

    const mainTs = join(fixtureRoot, "main.ts");
    const utilsMjs = join(fixtureRoot, "utils.mjs");

    writeFileSync(mainTs, `import { util } from "./utils.mjs";\nexport const main = util;`);
    writeFileSync(utilsMjs, `export const util = 1;`);

    const testConfig = getTestConfig();
    const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
    const astAnalyzer = createAstAnalyzer({ analyzer: "ts", graphqlHelper });
    clearFingerprintCache();

    const result = discoverModules({
      entryPaths: [mainTs],
      astAnalyzer,
    });
    if (result.isErr()) throw result.error;

    expect(result.value.snapshots).toHaveLength(2);

    const mjsSnapshot = result.value.snapshots.find((s) => s.filePath.endsWith("utils.mjs"));
    expect(mjsSnapshot).toBeDefined();
    expect(mjsSnapshot!.analysis.definitions).toHaveLength(0);
    expect(mjsSnapshot!.analysis.imports).toHaveLength(0);
    expect(mjsSnapshot!.analysis.exports).toHaveLength(0);

    rmSync(fixtureRoot, { recursive: true, force: true });
  });
});
