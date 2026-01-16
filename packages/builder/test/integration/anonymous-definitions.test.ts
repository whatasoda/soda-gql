import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBuilderSession } from "@soda-gql/builder";
import { runCodegen } from "@soda-gql/codegen";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const defaultInjectPath = path.join(projectRoot, "fixture-catalog/schemas/default/scalars.ts");

const copyDefaultInject = (destinationPath: string): void => {
  cpSync(defaultInjectPath, destinationPath);
};

const createTestConfig = (workspaceRoot: string): ResolvedSodaGqlConfig => ({
  analyzer: "ts" as const,
  outdir: path.join(workspaceRoot, "graphql-system"),
  graphqlSystemAliases: ["@/graphql-system"],
  include: [path.join(workspaceRoot, "**/*.ts")],
  exclude: [],
  schemas: {
    default: {
      schema: [path.join(workspaceRoot, "schema.graphql")],
      inject: { scalars: path.join(workspaceRoot, "inject/scalars.ts") },
      defaultInputDepth: 3,
      inputDepthOverrides: {},
    },
  },
  styles: {
    importExtension: false,
  },
  codegen: { chunkSize: 100 },
  plugins: {},
});

/**
 * Integration tests for anonymous gql definitions.
 * Verifies that the full build pipeline (analysis -> codegen -> evaluation -> aggregate)
 * works correctly with anonymous definitions like destructuring and function arguments.
 */
describe("Anonymous definitions integration", () => {
  let workspaceRoot: string;
  let originalCwd: string;
  let tmpRoot: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    tmpRoot = mkdtempSync(path.join(tmpdir(), "soda-gql-anon-"));
    const timestamp = Date.now();
    workspaceRoot = path.join(tmpRoot, `session-${timestamp}`);
    await fs.mkdir(workspaceRoot, { recursive: true });

    // Create minimal schema
    const schemaContent = `
type Query {
  users(limit: Int): [User!]!
  user(id: ID!): User
}

type User {
  id: ID!
  name: String!
}
`;
    await fs.writeFile(path.join(workspaceRoot, "schema.graphql"), schemaContent);

    // Copy inject file
    const injectDir = path.join(workspaceRoot, "inject");
    await fs.mkdir(injectDir, { recursive: true });
    copyDefaultInject(path.join(injectDir, "scalars.ts"));

    // Change to workspace
    process.chdir(workspaceRoot);

    // Generate graphql-system
    const outPath = path.join(workspaceRoot, "graphql-system", "index.ts");
    const codegenResult = await runCodegen({
      schemas: {
        default: {
          schema: [path.join(workspaceRoot, "schema.graphql")],
          inject: { scalars: path.join(injectDir, "scalars.ts") },
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
  });

  afterEach(async () => {
    if (originalCwd) {
      process.chdir(originalCwd);
    }
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test("builds successfully with destructuring pattern", async () => {
    // Create file with destructuring pattern
    const moduleContent = `
import { gql } from "./graphql-system";

const { useQueryOperation, $infer } = gql
  .default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }))
  .attach({});

export type UserFragment = typeof $infer;
export { useQueryOperation };
`;
    await fs.writeFile(path.join(workspaceRoot, "user-fragment.ts"), moduleContent);

    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });

    const result = await session.build();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();
    expect(Object.keys(artifact.elements).length).toBeGreaterThan(0);

    // Should have an element with _anonymous_ in the ID
    const anonymousElement = Object.keys(artifact.elements).find((id) => id.includes("_anonymous_"));
    expect(anonymousElement).toBeDefined();
  });

  test("builds successfully with operation destructuring pattern", async () => {
    // Create file with operation destructuring pattern
    const moduleContent = `
import { gql } from "./graphql-system";

const { useQueryOperation, $infer } = gql
  .default(({ query }) =>
    query.operation({
      name: "ListUsers",
      variables: {},
      fields: () => ({}),
    }),
  )
  .attach({});

export type ListUsersQuery = typeof $infer;
export { useQueryOperation };
`;
    await fs.writeFile(path.join(workspaceRoot, "list-users.ts"), moduleContent);

    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });

    const result = await session.build();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();
    expect(Object.keys(artifact.elements).length).toBeGreaterThan(0);

    // Should have an element with _anonymous_ in the ID
    const anonymousElement = Object.keys(artifact.elements).find((id) => id.includes("_anonymous_"));
    expect(anonymousElement).toBeDefined();
  });

  test("builds successfully with multiple anonymous definitions", async () => {
    // Create file with multiple anonymous definitions
    const moduleContent = `
import { gql } from "./graphql-system";

// First anonymous definition (destructuring)
const { useQueryOperation: useFirst } = gql
  .default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }))
  .attach({});

// Second anonymous definition (destructuring)
const { useQueryOperation: useSecond } = gql
  .default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.name() }) }))
  .attach({});

export { useFirst, useSecond };
`;
    await fs.writeFile(path.join(workspaceRoot, "multiple-anon.ts"), moduleContent);

    const evaluatorId = Bun.randomUUIDv7();
    const session = createBuilderSession({
      evaluatorId,
      entrypointsOverride: [path.join(workspaceRoot, "**/*.ts")],
      config: createTestConfig(workspaceRoot),
    });

    const result = await session.build();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();

    // Should have multiple anonymous elements
    const anonymousElements = Object.keys(artifact.elements).filter((id) => id.includes("_anonymous_"));
    expect(anonymousElements.length).toBe(2);

    // They should have different indices
    expect(anonymousElements.some((id) => id.includes("_anonymous_0"))).toBe(true);
    expect(anonymousElements.some((id) => id.includes("_anonymous_1"))).toBe(true);
  });
});
