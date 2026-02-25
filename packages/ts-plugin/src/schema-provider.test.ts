import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { createSchemaProvider } from "./schema-provider";

const fixturesDir = resolve(import.meta.dir, "../test/fixtures");
const configPath = resolve(fixturesDir, "soda-gql.config.ts");

describe("createSchemaProvider", () => {
  test("loads schema from config and returns GraphQLSchema for known name", () => {
    const provider = createSchemaProvider(fixturesDir, configPath);
    const schema = provider.getSchema("default");

    expect(schema).toBeDefined();
    // Verify the schema has the expected types
    const queryType = schema!.getQueryType();
    expect(queryType).toBeDefined();
    expect(queryType!.name).toBe("Query");

    const userType = schema!.getType("User");
    expect(userType).toBeDefined();
  });

  test("returns undefined for unknown schema name", () => {
    const provider = createSchemaProvider(fixturesDir, configPath);
    const schema = provider.getSchema("nonexistent");

    expect(schema).toBeUndefined();
  });

  test("reload refreshes cached schemas", () => {
    const provider = createSchemaProvider(fixturesDir, configPath);

    // Schema should be loaded
    expect(provider.getSchema("default")).toBeDefined();

    // Reload should succeed
    const result = provider.reload();
    expect(result).toBe(true);

    // Schema should still be available after reload
    expect(provider.getSchema("default")).toBeDefined();
  });

  test("returns no schemas when config path is invalid", () => {
    const provider = createSchemaProvider("/nonexistent/path");
    const schema = provider.getSchema("default");

    expect(schema).toBeUndefined();
  });
});
