import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBuilderSession } from "@soda-gql/builder";
import { runCodegen } from "@soda-gql/codegen";
import type { ResolvedSodaGqlConfig, ResolvedTsconfigPaths } from "@soda-gql/config";

// Project root for accessing shared test fixtures
const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const defaultInjectPath = path.join(projectRoot, "fixture-catalog/schemas/default/scalars.ts");
const schemaPath = path.join(projectRoot, "fixture-catalog/fixtures/incremental/schema.graphql");

/**
 * Create a test config with tsconfigPaths.
 */
const createTestConfig = (
  workspaceRoot: string,
  options?: {
    tsconfigPaths?: ResolvedTsconfigPaths;
    graphqlSystemAliases?: readonly string[];
  },
): ResolvedSodaGqlConfig => ({
  analyzer: "ts" as const,
  baseDir: workspaceRoot,
  outdir: path.join(workspaceRoot, "graphql-system"),
  graphqlSystemAliases: options?.graphqlSystemAliases ?? ["@/graphql-system"],
  include: [path.join(workspaceRoot, "src/**/*.ts")],
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
  codegen: {
    chunkSize: 100,
  },
  plugins: {},
  ...(options?.tsconfigPaths ? { tsconfigPaths: options.tsconfigPaths } : {}),
});

/**
 * Integration tests for tsconfig paths resolution.
 * These tests verify that path aliases are resolved during module discovery.
 */
describe("tsconfig paths resolution", () => {
  let workspaceRoot: string;
  let originalCwd: string;
  let tmpRoot: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Create temporary workspace in system temp
    tmpRoot = mkdtempSync(path.join(tmpdir(), "soda-gql-tsconfig-paths-"));
    const timestamp = Date.now();
    workspaceRoot = path.join(tmpRoot, `session-${timestamp}`);
    await fs.mkdir(workspaceRoot, { recursive: true });

    // Copy schema and inject files
    cpSync(schemaPath, path.join(workspaceRoot, "schema.graphql"));
    cpSync(defaultInjectPath, path.join(workspaceRoot, "graphql-inject.ts"));

    // Change to workspace
    process.chdir(workspaceRoot);

    // Generate graphql-system
    const codegenResult = await runCodegen({
      schemas: {
        default: {
          schema: [path.join(workspaceRoot, "schema.graphql")],
          inject: { scalars: path.join(workspaceRoot, "graphql-inject.ts") },
        },
      },
      outPath: path.join(workspaceRoot, "graphql-system", "index.ts"),
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

  test("resolves wildcard path alias (@utils/*) for discovery", async () => {
    // Create directory structure
    await fs.mkdir(path.join(workspaceRoot, "src"), { recursive: true });
    await fs.mkdir(path.join(workspaceRoot, "src/utils"), { recursive: true });

    // Create a utility file at src/utils/employee-query.ts
    const employeeQueryContent = `
import { gql } from "../../graphql-system";

export const employeeQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetEmployeeById",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src/utils/employee-query.ts"), employeeQueryContent);

    // Create a main file that imports using path alias but just re-exports
    const mainContent = `
import { gql } from "../graphql-system";
// Import via alias - the file should be discovered via alias resolution
import { employeeQuery } from "@utils/employee-query";

// Re-export the imported query
export { employeeQuery };

// Also define a local query
export const listEmployeesQuery = gql.default(({ query }) =>
  query.operation({
    name: "ListEmployees",
    fields: ({ f }) => ({
      ...f.employees()(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src/main.ts"), mainContent);

    // Create tsconfigPaths config
    const tsconfigPaths: ResolvedTsconfigPaths = {
      baseUrl: workspaceRoot,
      paths: {
        "@utils/*": [path.join(workspaceRoot, "src/utils/*")],
      },
    };

    const session = createBuilderSession({
      evaluatorId: Bun.randomUUIDv7(),
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot, { tsconfigPaths }),
    });

    const result = session.build();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();

    // Should have elements from both files
    // Element keys are in the format: filepath::exportName
    const elementNames = Object.keys(artifact.elements);
    expect(elementNames.length).toBe(2);

    // Check that elements from both files exist
    expect(elementNames.some((name) => name.includes("employeeQuery"))).toBe(true);
    expect(elementNames.some((name) => name.includes("listEmployeesQuery"))).toBe(true);
  });

  test("resolves exact match path alias (@graphql-system)", async () => {
    // Create directory structure
    await fs.mkdir(path.join(workspaceRoot, "src"), { recursive: true });

    // Create a main file that imports using exact match path alias
    const mainContent = `
import { gql } from "@graphql-system";

export const simpleQuery = gql.default(({ query }) =>
  query.operation({
    name: "SimpleQuery",
    fields: ({ f }) => ({
      ...f.employees()(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src/main.ts"), mainContent);

    // Create tsconfigPaths config with exact match
    const tsconfigPaths: ResolvedTsconfigPaths = {
      baseUrl: workspaceRoot,
      paths: {
        "@graphql-system": [path.join(workspaceRoot, "graphql-system/index.ts")],
      },
    };

    const session = createBuilderSession({
      evaluatorId: Bun.randomUUIDv7(),
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot, {
        tsconfigPaths,
        // Also add the alias to graphqlSystemAliases
        graphqlSystemAliases: ["@graphql-system", "@/graphql-system"],
      }),
    });

    const result = session.build();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();

    // Should have element from the file
    const elementNames = Object.keys(artifact.elements);
    expect(elementNames.length).toBe(1);
    expect(elementNames.some((name) => name.includes("simpleQuery"))).toBe(true);
  });

  test("falls back to external when alias does not match", async () => {
    // Create directory structure
    await fs.mkdir(path.join(workspaceRoot, "src"), { recursive: true });

    // Create a main file with imports
    const mainContent = `
import { gql } from "../graphql-system";

// This just tests that unmatched aliases are treated as external
export const simpleQuery = gql.default(({ query }) =>
  query.operation({
    name: "ExternalTest",
    fields: ({ f }) => ({
      ...f.employees()(({ f }) => ({ ...f.id() })),
    }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src/main.ts"), mainContent);

    // Create tsconfigPaths config with alias that won't match
    const tsconfigPaths: ResolvedTsconfigPaths = {
      baseUrl: workspaceRoot,
      paths: {
        "@other/*": [path.join(workspaceRoot, "other/*")],
      },
    };

    const session = createBuilderSession({
      evaluatorId: Bun.randomUUIDv7(),
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot, { tsconfigPaths }),
    });

    const result = session.build();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();
    expect(Object.keys(artifact.elements).length).toBe(1);
  });

  test("multiple path patterns resolve correctly", async () => {
    // Create directory structure
    await fs.mkdir(path.join(workspaceRoot, "src"), { recursive: true });
    await fs.mkdir(path.join(workspaceRoot, "src/features"), { recursive: true });
    await fs.mkdir(path.join(workspaceRoot, "src/shared"), { recursive: true });

    // Create a shared file with a query
    const sharedContent = `
import { gql } from "../../graphql-system";

export const companyQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetCompany",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.company({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src/shared/company.ts"), sharedContent);

    // Create a features file with another query
    const featureContent = `
import { gql } from "../../graphql-system";
// Re-export from shared via alias
export { companyQuery } from "@shared/company";

export const departmentQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetDepartment",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.department({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src/features/department.ts"), featureContent);

    // Create main that uses features
    const mainContent = `
import { gql } from "../graphql-system";
// Re-export from features via alias
export { departmentQuery, companyQuery } from "@features/department";

export const teamQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetTeam",
    variables: { ...$var("id").ID("!") },
    fields: ({ f, $ }) => ({
      ...f.team({ id: $.id })(({ f }) => ({
        ...f.id(),
        ...f.name(),
      })),
    }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src/main.ts"), mainContent);

    // Create tsconfigPaths config with multiple patterns
    const tsconfigPaths: ResolvedTsconfigPaths = {
      baseUrl: workspaceRoot,
      paths: {
        "@features/*": [path.join(workspaceRoot, "src/features/*")],
        "@shared/*": [path.join(workspaceRoot, "src/shared/*")],
      },
    };

    const session = createBuilderSession({
      evaluatorId: Bun.randomUUIDv7(),
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot, { tsconfigPaths }),
    });

    const result = session.build();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();
    const elementNames = Object.keys(artifact.elements);

    // Should have elements from all three files
    expect(elementNames.length).toBe(3);
    expect(elementNames.some((name) => name.includes("companyQuery"))).toBe(true);
    expect(elementNames.some((name) => name.includes("departmentQuery"))).toBe(true);
    expect(elementNames.some((name) => name.includes("teamQuery"))).toBe(true);
  });

  test("build works without tsconfigPaths (backward compatible)", async () => {
    // Create directory structure
    await fs.mkdir(path.join(workspaceRoot, "src"), { recursive: true });

    // Create a main file using relative imports
    const mainContent = `
import { gql } from "../graphql-system";

export const simpleQuery = gql.default(({ query }) =>
  query.operation({
    name: "BackwardCompatTest",
    fields: ({ f }) => ({
      ...f.employees()(({ f }) => ({ ...f.id(), ...f.name() })),
    }),
  }),
);
`;
    await fs.writeFile(path.join(workspaceRoot, "src/main.ts"), mainContent);

    // No tsconfigPaths - config should still work
    const session = createBuilderSession({
      evaluatorId: Bun.randomUUIDv7(),
      entrypointsOverride: [path.join(workspaceRoot, "src/**/*.ts")],
      config: createTestConfig(workspaceRoot), // No tsconfigPaths
    });

    const result = session.build();

    if (result.isErr()) {
      console.error("Build failed:", result.error);
    }
    expect(result.isOk()).toBe(true);

    const artifact = result._unsafeUnwrap();
    const elementNames = Object.keys(artifact.elements);
    expect(elementNames.length).toBe(1);
    expect(elementNames.some((name) => name.includes("simpleQuery"))).toBe(true);
  });
});
