import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createSchemaResolver } from "./schema-resolver";

const fixturesDir = resolve(import.meta.dir, "../test/fixtures/schemas");

const createTestConfig = (
  schemas: Record<string, { schema: readonly string[] }>,
): ResolvedSodaGqlConfig =>
  ({
    analyzer: "swc" as const,
    baseDir: fixturesDir,
    outdir: resolve(fixturesDir, "graphql-system"),
    graphqlSystemAliases: ["@/graphql-system"],
    include: ["src/**/*.ts"],
    exclude: [],
    schemas: Object.fromEntries(
      Object.entries(schemas).map(([name, config]) => [
        name,
        {
          schema: config.schema,
          inject: { scalars: resolve(fixturesDir, "scalars.ts") },
          defaultInputDepth: 3,
          inputDepthOverrides: {},
        },
      ]),
    ),
    styles: { importExtension: false },
    codegen: { chunkSize: 100 },
    plugins: {},
  }) as ResolvedSodaGqlConfig;

describe("createSchemaResolver", () => {
  test("loads a single schema successfully", () => {
    const config = createTestConfig({
      default: { schema: [resolve(fixturesDir, "default.graphql")] },
    });
    const result = createSchemaResolver(config);
    expect(result.isOk()).toBe(true);

    const resolver = result._unsafeUnwrap();
    const entry = resolver.getSchema("default");
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("default");
    expect(entry!.hash).toBeTruthy();
    expect(entry!.schema).toBeDefined();
  });

  test("loads multiple schemas", () => {
    const config = createTestConfig({
      default: { schema: [resolve(fixturesDir, "default.graphql")] },
      admin: { schema: [resolve(fixturesDir, "admin.graphql")] },
    });
    const result = createSchemaResolver(config);
    expect(result.isOk()).toBe(true);

    const resolver = result._unsafeUnwrap();
    expect(resolver.getSchemaNames()).toEqual(["default", "admin"]);
    expect(resolver.getSchema("default")).toBeDefined();
    expect(resolver.getSchema("admin")).toBeDefined();
  });

  test("returns undefined for unknown schema name", () => {
    const config = createTestConfig({
      default: { schema: [resolve(fixturesDir, "default.graphql")] },
    });
    const resolver = createSchemaResolver(config)._unsafeUnwrap();
    expect(resolver.getSchema("unknown")).toBeUndefined();
  });

  test("reloadAll re-reads schemas from disk", () => {
    const config = createTestConfig({
      default: { schema: [resolve(fixturesDir, "default.graphql")] },
    });
    const resolver = createSchemaResolver(config)._unsafeUnwrap();
    const hashBefore = resolver.getSchema("default")!.hash;

    const reloadResult = resolver.reloadAll();
    expect(reloadResult.isOk()).toBe(true);

    const hashAfter = resolver.getSchema("default")!.hash;
    expect(hashAfter).toBe(hashBefore);
  });

  test("reloadSchema returns error for unknown schema", () => {
    const config = createTestConfig({
      default: { schema: [resolve(fixturesDir, "default.graphql")] },
    });
    const resolver = createSchemaResolver(config)._unsafeUnwrap();
    const result = resolver.reloadSchema("nonexistent");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SCHEMA_NOT_CONFIGURED");
    }
  });

  test("returns error when schema file does not exist", () => {
    const config = createTestConfig({
      broken: { schema: [resolve(fixturesDir, "nonexistent.graphql")] },
    });
    const result = createSchemaResolver(config);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("SCHEMA_LOAD_FAILED");
    }
  });
});
