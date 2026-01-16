import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBuilderSession } from "@soda-gql/builder";
import { runCodegen } from "@soda-gql/codegen";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

// Project root for accessing shared test fixtures
const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const defaultInjectPath = path.join(projectRoot, "fixture-catalog/schemas/default/scalars.ts");

/**
 * Create a test config for integration tests.
 */
const createTestConfig = (workspaceRoot: string): ResolvedSodaGqlConfig => ({
  analyzer: "ts" as const,
  baseDir: workspaceRoot,
  outdir: path.join(workspaceRoot, "graphql-system"),
  graphqlSystemAliases: ["@/graphql-system"],
  include: [path.join(workspaceRoot, "**/*.ts")],
  exclude: [],
  schemas: {
    default: {
      schema: [path.join(workspaceRoot, "schema.graphql")],
      inject: { scalars: path.join(workspaceRoot, "graphql-inject.ts") },
      defaultInputDepth: 3,
      inputDepthOverrides: {},
    },
  },
  styles: {
    importExtension: false,
  },
  plugins: {},
});

/**
 * Integration tests for async metadata resolution in VM sandbox.
 *
 * These tests verify that async operation metadata is properly resolved
 * when running through the builder (which uses VM sandbox for evaluation).
 */
describe("async metadata resolution", () => {
  let workspaceRoot: string;
  let originalCwd: string;
  let tmpRoot: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create temporary workspace
    tmpRoot = mkdtempSync(path.join(tmpdir(), "soda-gql-async-metadata-"));
    const timestamp = Date.now();
    workspaceRoot = path.join(tmpRoot, `workspace-${timestamp}`);
    await fs.mkdir(workspaceRoot, { recursive: true });

    // Copy schema
    const schemaPath = path.join(projectRoot, "fixture-catalog/schemas/default/schema.graphql");
    cpSync(schemaPath, path.join(workspaceRoot, "schema.graphql"));

    // Copy inject
    cpSync(defaultInjectPath, path.join(workspaceRoot, "graphql-inject.ts"));

    // Generate graphql-system
    const outPath = path.join(workspaceRoot, "graphql-system", "index.ts");
    const codegenResult = await runCodegen({
      schemas: {
        default: {
          schema: [path.join(workspaceRoot, "schema.graphql")],
          inject: { scalars: path.join(workspaceRoot, "graphql-inject.ts") },
        },
      },
      outPath,
      format: "json",
    });

    if (codegenResult.isErr()) {
      throw new Error(`codegen failed: ${codegenResult.error.code}`);
    }

    // Ensure cache directory exists
    const cacheDir = path.join(workspaceRoot, ".cache/soda-gql/builder");
    await fs.mkdir(cacheDir, { recursive: true });

    process.chdir(workspaceRoot);
  });

  afterEach(async () => {
    if (originalCwd) {
      process.chdir(originalCwd);
    }
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("resolves async operation metadata through builder", async () => {
    // Copy the async-metadata-operation fixture
    const fixturePath = path.join(projectRoot, "fixture-catalog/fixtures/core/valid/async-metadata-operation.ts");
    const fixtureContent = await fs.readFile(fixturePath, "utf-8");

    // Rewrite graphql-system import to relative path
    const rewrittenContent = fixtureContent.replace(/from\s+["'][^"']*graphql-system["']/g, 'from "./graphql-system"');

    await fs.writeFile(path.join(workspaceRoot, "async-operation.ts"), rewrittenContent);

    // Create session and build
    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "async-operation.ts")],
      config: createTestConfig(workspaceRoot),
    });

    const result = await session.buildAsync();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();

    // Find the operation element
    const operationEntry = Object.entries(artifact.elements).find(([_, el]) => el.type === "operation");
    expect(operationEntry).toBeDefined();

    const [, operationElement] = operationEntry!;
    expect(operationElement.type).toBe("operation");

    // Access prebuild.metadata
    const prebuild = operationElement.prebuild as { metadata?: unknown };
    const metadata = prebuild.metadata;

    // Verify metadata is NOT a Promise-like (should be resolved)
    const isPromiseLike = metadata && typeof metadata === "object" && "then" in metadata;
    expect(isPromiseLike).toBe(false);

    // Verify metadata has the expected values
    expect(metadata).toBeDefined();
    expect(metadata).toHaveProperty("asyncKey", "asyncValue");
    expect(metadata).toHaveProperty("timestamp", 12345);
  });

  test("resolves sync operation metadata through builder", async () => {
    // Create a source file with sync metadata
    const sourceContent = `
import { gql } from "./graphql-system";

export const syncMetadataQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "SyncMetadataQuery",
    variables: { ...$var("id").ID("!") },
    metadata: () => {
      return { syncKey: "syncValue", value: 42 };
    },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.id })(({ f }) => ({ ...f.id() })) }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "sync-operation.ts"), sourceContent);

    // Create session and build
    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "sync-operation.ts")],
      config: createTestConfig(workspaceRoot),
    });

    const result = await session.buildAsync();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();

    // Find the operation element
    const operationEntry = Object.entries(artifact.elements).find(([_, el]) => el.type === "operation");
    expect(operationEntry).toBeDefined();

    const [, operationElement] = operationEntry!;
    const prebuild = operationElement.prebuild as { metadata?: unknown };
    const metadata = prebuild.metadata;

    // Verify sync metadata is resolved correctly
    expect(metadata).toEqual({ syncKey: "syncValue", value: 42 });
  });

  test("resolves async operation metadata with nested objects", async () => {
    // Create a source file with async metadata returning nested object
    const sourceContent = `
import { gql } from "./graphql-system";

export const nestedAsyncMetadataQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "NestedAsyncMetadataQuery",
    variables: { ...$var("id").ID("!") },
    metadata: async () => {
      await Promise.resolve();
      return {
        headers: { "X-Custom": "value", "Authorization": "Bearer token" },
        options: { retry: true, timeout: 5000 },
        tags: ["important", "async"],
      };
    },
    fields: ({ f, $ }) => ({ ...f.employee({ id: $.id })(({ f }) => ({ ...f.id() })) }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "nested-async-operation.ts"), sourceContent);

    // Create session and build
    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "nested-async-operation.ts")],
      config: createTestConfig(workspaceRoot),
    });

    const result = await session.buildAsync();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();

    // Find the operation element
    const operationEntry = Object.entries(artifact.elements).find(([_, el]) => el.type === "operation");
    expect(operationEntry).toBeDefined();

    const [, operationElement] = operationEntry!;
    const prebuild = operationElement.prebuild as { metadata?: unknown };
    const metadata = prebuild.metadata;

    // Verify nested metadata is resolved correctly
    expect(metadata).toEqual({
      headers: { "X-Custom": "value", Authorization: "Bearer token" },
      options: { retry: true, timeout: 5000 },
      tags: ["important", "async"],
    });
  });
});
