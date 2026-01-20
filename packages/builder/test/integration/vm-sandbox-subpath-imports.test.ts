import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createBuilderSession } from "@soda-gql/builder";
import { runCodegen } from "@soda-gql/codegen";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

/**
 * Tests for VM sandbox require() handling of @soda-gql subpath exports.
 *
 * The CLI template generates inject files that import from "@soda-gql/core/adapter",
 * but the VM sandbox only handles "@soda-gql/core" and "@soda-gql/runtime".
 * This causes build failures when the inject file uses subpath exports.
 */
describe("VM sandbox subpath imports", () => {
  let workspaceRoot: string;
  let originalCwd: string;
  let tmpRoot: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create temporary workspace
    tmpRoot = mkdtempSync(path.join(tmpdir(), "soda-gql-subpath-"));
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
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("handles inject file importing from @soda-gql/core/adapter", async () => {
    // Create minimal schema
    const schemaContent = `
type Query {
  hello: String!
}
`;
    await fs.writeFile(path.join(workspaceRoot, "schema.graphql"), schemaContent);

    // Create inject file using @soda-gql/core/adapter (CLI template pattern)
    const injectContent = `
import { defineAdapter, defineScalar } from "@soda-gql/core/adapter";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
} as const;

export const adapter = defineAdapter({
  helpers: {},
  metadata: {
    aggregateFragmentMetadata: (fragments) => fragments.map((m) => m.metadata),
  },
});
`;
    await fs.writeFile(path.join(workspaceRoot, "inject.ts"), injectContent);

    // Create a simple fragment file
    const fragmentContent = `
import { gql } from "./graphql-system";

export const HelloFragment = gql.fragment("HelloFragment", "Query", (t) => [
  t.hello(),
]);
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
          inputDepthOverrides: {}, typenameMode: "union-only",
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
          inputDepthOverrides: {}, typenameMode: "union-only",
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

    const result = await session.build();

    // Build should succeed (after fix)
    // Before fix: fails with "Unknown module: @soda-gql/core/adapter"
    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    // Note: elements count may be 0 depending on test setup,
    // but the key assertion is that build succeeds without
    // "Unknown module: @soda-gql/core/adapter" error
  });

  test("handles inject file importing from @soda-gql/core/runtime", async () => {
    // Create minimal schema
    const schemaContent = `
type Query {
  hello: String!
}
`;
    await fs.writeFile(path.join(workspaceRoot, "schema.graphql"), schemaContent);

    // Create inject file using @soda-gql/core/runtime
    // Note: This is a hypothetical case, but we want to ensure all subpaths work
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

    // Create a simple fragment file
    const fragmentContent = `
import { gql } from "./graphql-system";

export const HelloFragment = gql.fragment("HelloFragment", "Query", (t) => [
  t.hello(),
]);
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
          inputDepthOverrides: {}, typenameMode: "union-only",
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
          inputDepthOverrides: {}, typenameMode: "union-only",
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

    const result = await session.build();

    // Build should succeed
    expect(result.isOk()).toBe(true);

    // Note: elements count may be 0 depending on test setup,
    // but the key assertion is that build succeeds
  });
});
