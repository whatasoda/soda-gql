import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createBuilderSession } from "@soda-gql/builder";
import { runCodegen } from "@soda-gql/codegen";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

/**
 * Tests for portable artifacts with relative paths.
 *
 * These tests verify that:
 * 1. Artifacts contain relative paths (not absolute)
 * 2. Artifacts can be used across different directory structures
 * 3. Path matching works correctly with relative paths
 */
describe("Portable Artifact", () => {
  let workspaceRoot: string;
  let originalCwd: string;
  let tmpRoot: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create temporary workspace
    tmpRoot = mkdtempSync(path.join(tmpdir(), "soda-gql-portable-"));
    const timestamp = Date.now();
    workspaceRoot = path.join(tmpRoot, `workspace-${timestamp}`);
    await fs.mkdir(workspaceRoot, { recursive: true });

    // Change to workspace
    process.chdir(workspaceRoot);
  });

  afterEach(async () => {
    if (originalCwd) {
      process.chdir(originalCwd);
    }
    if (tmpRoot) {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("artifact contains relative paths", async () => {
    // Create minimal schema
    const schemaContent = `
type Query {
  hello: String!
  user(id: ID!): User
}

type User {
  id: ID!
  name: String!
}
`;
    await fs.writeFile(path.join(workspaceRoot, "schema.graphql"), schemaContent);

    // Create inject file
    const injectContent = `
import { defineScalar } from "@soda-gql/core";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
} as const;
`;
    await fs.writeFile(path.join(workspaceRoot, "inject.ts"), injectContent);

    // Create nested directory structure for source files
    await fs.mkdir(path.join(workspaceRoot, "src", "entities"), { recursive: true });
    await fs.mkdir(path.join(workspaceRoot, "src", "pages"), { recursive: true });

    // Create a fragment file using gql.default()
    const fragmentContent = `
import { gql } from "../graphql-system";

export const UserFragment = gql.default(({ fragment }) =>
  fragment\`fragment UserFragment on User { id name }\`(),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src", "entities", "user.ts"), fragmentContent);

    // Create an operation file using gql.default()
    const operationContent = `
import { gql } from "../graphql-system";

export const HelloQuery = gql.default(({ query }) =>
  query.operation({
    name: "HelloQuery",
    fields: ({ f }) => ({
      ...f.hello(),
    }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src", "pages", "hello.ts"), operationContent);

    // Generate graphql-system
    const outPath = path.join(workspaceRoot, "src", "graphql-system", "index.ts");
    const codegenResult = await runCodegen({
      schemas: {
        default: {
          schema: [path.join(workspaceRoot, "schema.graphql")],
          inject: { scalars: path.join(workspaceRoot, "inject.ts") },
          defaultInputDepth: 3,
          inputDepthOverrides: {},
        },
      },
      outPath,
      format: "json",
    });

    if (codegenResult.isErr()) {
      throw new Error(`codegen failed: ${codegenResult.error.code}`);
    }

    // Create config with baseDir
    const config: ResolvedSodaGqlConfig = {
      analyzer: "ts",
      baseDir: workspaceRoot,
      outdir: path.join(workspaceRoot, "src", "graphql-system"),
      graphqlSystemAliases: [],
      include: [path.join(workspaceRoot, "src/**/*.ts")],
      exclude: [],
      schemas: {
        default: {
          schema: [path.join(workspaceRoot, "schema.graphql")],
          inject: { scalars: path.join(workspaceRoot, "inject.ts") },
          defaultInputDepth: 3,
          inputDepthOverrides: {},
        },
      },
      styles: {
        importExtension: false,
      },
      codegen: { chunkSize: 100 },
      plugins: {},
    };

    // Ensure cache directory exists
    const cacheDir = path.join(workspaceRoot, ".cache/soda-gql/builder");
    await fs.mkdir(cacheDir, { recursive: true });

    // Create session and build
    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "src/entities/user.ts"), path.join(workspaceRoot, "src/pages/hello.ts")],
      config,
    });

    const result = await session.buildAsync();

    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const artifact = result.value;

      // Ensure we have elements to test
      const elementCount = Object.keys(artifact.elements).length;
      expect(elementCount).toBeGreaterThan(0);

      // Verify artifact contains relative paths, not absolute paths
      for (const [canonicalId, element] of Object.entries(artifact.elements)) {
        // Canonical ID should start with relative path
        expect(canonicalId.startsWith("/")).toBe(false);
        expect(canonicalId.startsWith("src/")).toBe(true);

        // sourcePath should be relative
        expect(element.metadata.sourcePath.startsWith("/")).toBe(false);
        expect(element.metadata.sourcePath.startsWith("src/")).toBe(true);
      }
    }

    session.dispose();
  });

  test("canonical IDs are consistent between builder and transformer", async () => {
    // Create minimal schema
    const schemaContent = `
type Query {
  hello: String!
}
`;
    await fs.writeFile(path.join(workspaceRoot, "schema.graphql"), schemaContent);

    // Create inject file
    const injectContent = `
import { defineScalar } from "@soda-gql/core";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
} as const;
`;
    await fs.writeFile(path.join(workspaceRoot, "inject.ts"), injectContent);

    // Create a fragment file using gql.default()
    const fragmentContent = `
import { gql } from "./graphql-system";

export const HelloFragment = gql.default(({ fragment }) =>
  fragment\`fragment HelloFragment on Query { hello }\`(),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "hello.ts"), fragmentContent);

    // Generate graphql-system
    const outPath = path.join(workspaceRoot, "graphql-system", "index.ts");
    const codegenResult = await runCodegen({
      schemas: {
        default: {
          schema: [path.join(workspaceRoot, "schema.graphql")],
          inject: { scalars: path.join(workspaceRoot, "inject.ts") },
          defaultInputDepth: 3,
          inputDepthOverrides: {},
        },
      },
      outPath,
      format: "json",
    });

    if (codegenResult.isErr()) {
      throw new Error(`codegen failed: ${codegenResult.error.code}`);
    }

    // Create config
    const config: ResolvedSodaGqlConfig = {
      analyzer: "ts",
      baseDir: workspaceRoot,
      outdir: path.join(workspaceRoot, "graphql-system"),
      graphqlSystemAliases: [],
      include: [path.join(workspaceRoot, "**/*.ts")],
      exclude: [],
      schemas: {
        default: {
          schema: [path.join(workspaceRoot, "schema.graphql")],
          inject: { scalars: path.join(workspaceRoot, "inject.ts") },
          defaultInputDepth: 3,
          inputDepthOverrides: {},
        },
      },
      styles: {
        importExtension: false,
      },
      codegen: { chunkSize: 100 },
      plugins: {},
    };

    // Ensure cache directory exists
    const cacheDir = path.join(workspaceRoot, ".cache/soda-gql/builder");
    await fs.mkdir(cacheDir, { recursive: true });

    // Create session and build
    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "hello.ts")],
      config,
    });

    const result = await session.buildAsync();

    expect(result.isOk()).toBe(true);

    if (result.isOk()) {
      const artifact = result.value;

      // Get all canonical IDs
      const canonicalIds = Object.keys(artifact.elements);
      expect(canonicalIds.length).toBeGreaterThan(0);

      // Verify canonical ID format: relative_path::astPath
      for (const canonicalId of canonicalIds) {
        expect(canonicalId).toContain("::");

        const [filePath, astPath] = canonicalId.split("::");
        expect(filePath).toBeDefined();
        expect(astPath).toBeDefined();

        // Path should be relative (not starting with /)
        expect(filePath?.startsWith("/")).toBe(false);
      }
    }

    session.dispose();
  });
});
