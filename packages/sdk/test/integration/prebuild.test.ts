import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCodegen } from "@soda-gql/codegen";
import { prebuild, prebuildAsync } from "../../src/prebuild";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Integration tests for SDK prebuild API.
 * Tests actual build execution with real config files and GraphQL systems.
 */
describe("prebuild integration", () => {
  let workspaceRoot: string;
  let tmpRoot: string;
  let originalCwd: string;
  let configPath: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create temp workspace
    tmpRoot = mkdtempSync(path.join(tmpdir(), "sdk-prebuild-"));
    workspaceRoot = path.join(tmpRoot, `workspace-${Date.now()}`);
    await fs.mkdir(workspaceRoot, { recursive: true });

    // Copy schema (use actual file, not symlink)
    const schemaSource = path.join(projectRoot, "fixture-catalog/schemas/default/schema.graphql");
    const schemaDest = path.join(workspaceRoot, "schema.graphql");
    cpSync(schemaSource, schemaDest);

    // Copy inject/scalars
    const injectSource = path.join(projectRoot, "fixture-catalog/schemas/default/scalars.ts");
    const injectDir = path.join(workspaceRoot, "inject");
    await fs.mkdir(injectDir, { recursive: true });
    cpSync(injectSource, path.join(injectDir, "scalars.ts"));

    // Generate graphql-system
    const outPath = path.join(workspaceRoot, "graphql-system", "index.ts");
    const codegenResult = await runCodegen({
      schemas: {
        default: {
          schema: [schemaDest],
          inject: { scalars: path.join(injectDir, "scalars.ts") },
        },
      },
      outPath,
      format: "json",
    });
    if (codegenResult.isErr()) {
      throw new Error(`codegen failed: ${codegenResult.error.code}`);
    }

    // Create source file
    const sourceFile = path.join(workspaceRoot, "src", "employee-fragment.ts");
    await fs.mkdir(path.join(workspaceRoot, "src"), { recursive: true });
    writeFileSync(
      sourceFile,
      `
import { gql } from "../graphql-system";

export const employeeFragment = gql.default(({ fragment }) =>
  fragment.Employee({ fields: ({ f }) => ({ ...f.id(), ...f.name() }) })
);

export const employeeQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetEmployee",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.id })(({ f }) => ({ ...f.id() })) }),
  })
);
`,
    );

    // Create soda-gql.config.ts
    configPath = path.join(workspaceRoot, "soda-gql.config.ts");
    writeFileSync(
      configPath,
      `
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  analyzer: "ts",
  outdir: "./graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: ["./schema.graphql"],
      inject: { scalars: "./inject/scalars.ts" },
    },
  },
});
`,
    );

    // Ensure cache directory
    await fs.mkdir(path.join(workspaceRoot, "node_modules/.cache/soda-gql/builder"), { recursive: true });

    process.chdir(workspaceRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("prebuild returns artifact with elements", () => {
    const result = prebuild({ configPath });

    expect(result.isOk()).toBe(true);
    const { artifact } = result._unsafeUnwrap();
    expect(Object.keys(artifact.elements).length).toBeGreaterThan(0);
  });

  test("prebuildAsync returns artifact with elements", async () => {
    const result = await prebuildAsync({ configPath });

    expect(result.isOk()).toBe(true);
    const { artifact } = result._unsafeUnwrap();
    expect(Object.keys(artifact.elements).length).toBeGreaterThan(0);
  });

  test("contextTransformer is called during build", async () => {
    let transformerCalled = false;
    let receivedContext: Record<string, unknown> | null = null;

    const result = await prebuildAsync({
      configPath,
      contextTransformer: (ctx) => {
        transformerCalled = true;
        receivedContext = ctx;
        return { ...ctx, customKey: "customValue" };
      },
    });

    expect(result.isOk()).toBe(true);
    expect(transformerCalled).toBe(true);
    expect(receivedContext).not.toBeNull();
  });

  test("force option triggers rebuild even without changes", async () => {
    // First build
    const first = await prebuildAsync({ configPath });
    expect(first.isOk()).toBe(true);

    // Second build without force - should use cache (skips > 0)
    const second = await prebuildAsync({ configPath });
    expect(second.isOk()).toBe(true);
    const secondArtifact = second._unsafeUnwrap().artifact;
    expect(secondArtifact.report.stats.skips).toBeGreaterThan(0);

    // Third build with force - should rebuild (misses > 0, skips = 0)
    const third = await prebuildAsync({ configPath, force: true });
    expect(third.isOk()).toBe(true);
    const thirdArtifact = third._unsafeUnwrap().artifact;
    expect(thirdArtifact.report.stats.misses).toBeGreaterThan(0);
  });

  test("evaluatorId option isolates cache", async () => {
    // Build with evaluatorId "a"
    const resultA = await prebuildAsync({ configPath, evaluatorId: "test-a" });
    expect(resultA.isOk()).toBe(true);
    const artifactA = resultA._unsafeUnwrap().artifact;
    // First build should have misses
    expect(artifactA.report.stats.misses).toBeGreaterThan(0);

    // Build with different evaluatorId "b" - should not use cache from "a"
    const resultB = await prebuildAsync({ configPath, evaluatorId: "test-b" });
    expect(resultB.isOk()).toBe(true);
    const artifactB = resultB._unsafeUnwrap().artifact;
    // Should also have misses since cache is isolated
    expect(artifactB.report.stats.misses).toBeGreaterThan(0);
  });

  test("dispose() writes cache.json to disk", async () => {
    const cacheFilePath = path.join(workspaceRoot, "node_modules/.cache/soda-gql/builder/cache.json");

    // Cache file should not exist before build (directory exists but file doesn't)
    expect(existsSync(cacheFilePath)).toBe(false);

    await prebuildAsync({ configPath });

    // After dispose(), cache file should exist
    expect(existsSync(cacheFilePath)).toBe(true);
  });

  test("dispose() saves cache with valid structure", async () => {
    const cacheFilePath = path.join(workspaceRoot, "node_modules/.cache/soda-gql/builder/cache.json");

    await prebuildAsync({ configPath });

    const content = readFileSync(cacheFilePath, "utf-8");
    const data = JSON.parse(content);

    expect(data.version).toBe("v1");
    expect(typeof data.storage).toBe("object");
    expect(Object.keys(data.storage).length).toBeGreaterThan(0);
  });

  test("persisted cache enables incremental builds across sessions", async () => {
    // First build - should have cache misses
    const first = await prebuildAsync({ configPath });
    expect(first.isOk()).toBe(true);
    expect(first._unsafeUnwrap().artifact.report.stats.misses).toBeGreaterThan(0);

    // Second build with force (new session) - should have cache hits from persisted cache
    const second = await prebuildAsync({ configPath, force: true });
    expect(second.isOk()).toBe(true);
    expect(second._unsafeUnwrap().artifact.report.stats.hits).toBeGreaterThan(0);
  });
});
