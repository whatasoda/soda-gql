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
  baseDir: workspaceRoot,
  outdir: path.join(workspaceRoot, "graphql-system"),
  graphqlSystemAliases: ["@/graphql-system"],
  include: [path.join(workspaceRoot, "**/*.ts")],
  exclude: [],
  schemas: {
    default: {
      schema: [path.join(workspaceRoot, "schema.graphql")],
      inject: { scalars: path.join(workspaceRoot, "inject/scalars.ts") },
      defaultInputDepth: 3,
      inputDepthOverrides: {}, typenameMode: "union-only",
    },
  },
  styles: {
    importExtension: false,
  },
  codegen: { chunkSize: 100 },
  plugins: {},
});

/**
 * Integration tests for GqlDefine element type.
 * Verifies that define elements are:
 * - Properly recognized and evaluated during build
 * - Excluded from final BuilderArtifact (aggregate phase)
 * - Can store and retrieve primitive values, plain objects, and arrays
 */
describe("GqlDefine integration", () => {
  let workspaceRoot: string;
  let originalCwd: string;
  let tmpRoot: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    tmpRoot = mkdtempSync(path.join(tmpdir(), "soda-gql-define-"));
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

  test("define with primitive value is excluded from final artifact", async () => {
    // Create file with define returning a primitive value
    const moduleContent = `
import { gql } from "./graphql-system";

export const MyNumber = gql.default(({ define }) => define(() => 42));
`;
    await fs.writeFile(path.join(workspaceRoot, "define-primitive.ts"), moduleContent);

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

    // Define elements should be excluded from final artifact
    const defineElement = Object.entries(artifact.elements).find(([id]) => id.includes("define-primitive"));
    expect(defineElement).toBeUndefined();
  });

  test("define with plain object is excluded from final artifact", async () => {
    // Create file with define returning a plain object
    const moduleContent = `
import { gql } from "./graphql-system";

export const MyConfig = gql.default(({ define }) =>
  define(() => ({
    apiUrl: "https://api.example.com",
    timeout: 5000,
  }))
);
`;
    await fs.writeFile(path.join(workspaceRoot, "define-object.ts"), moduleContent);

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

    // Define elements should be excluded from final artifact
    const defineElement = Object.entries(artifact.elements).find(([id]) => id.includes("define-object"));
    expect(defineElement).toBeUndefined();
  });

  test("define with array is excluded from final artifact", async () => {
    // Create file with define returning an array
    const moduleContent = `
import { gql } from "./graphql-system";

export const MyArray = gql.default(({ define }) => define(() => ["a", "b", "c"]));
`;
    await fs.writeFile(path.join(workspaceRoot, "define-array.ts"), moduleContent);

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

    // Define elements should be excluded from final artifact
    const defineElement = Object.entries(artifact.elements).find(([id]) => id.includes("define-array"));
    expect(defineElement).toBeUndefined();
  });

  test("mixed define and fragment/operation - only non-define elements in artifact", async () => {
    // Create file with both define and fragment
    const moduleContent = `
import { gql } from "./graphql-system";

// Define element - should be excluded
export const MyConfig = gql.default(({ define }) =>
  define(() => ({ key: "value" }))
);

// Fragment element - should be included
export const UserFragment = gql.default(({ fragment }) =>
  fragment.User({ fields: ({ f }) => ({ ...f.id() }) })
);
`;
    await fs.writeFile(path.join(workspaceRoot, "mixed-elements.ts"), moduleContent);

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

    // Should have at least one element (the fragment)
    expect(Object.keys(artifact.elements).length).toBeGreaterThan(0);

    // All elements should be fragment or operation, not define
    for (const [, element] of Object.entries(artifact.elements)) {
      expect(["fragment", "operation"]).toContain(element.type);
    }

    // Should have the fragment
    const fragmentElement = Object.entries(artifact.elements).find(([, el]) => el.type === "fragment");
    expect(fragmentElement).toBeDefined();
  });
});
