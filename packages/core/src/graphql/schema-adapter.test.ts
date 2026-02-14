import { describe, expect, it } from "bun:test";
import type { AnyGraphqlSchema } from "../types/schema/schema";
import { createSchemaIndexFromSchema } from "./schema-adapter";

describe("createSchemaIndexFromSchema", () => {
  const schema = {
    label: "test",
    operations: { query: "Query", mutation: "Mutation", subscription: null },
    scalar: { DateTime: { name: "DateTime", $type: {} } },
    enum: { Status: { name: "Status", values: { ACTIVE: true, INACTIVE: true } } },
    input: { UserFilter: { name: "UserFilter", fields: {} } },
    object: { User: { name: "User", fields: {} }, Query: { name: "Query", fields: {} } },
    union: { SearchResult: { name: "SearchResult", types: { User: true } } },
  } as unknown as AnyGraphqlSchema;

  it("scalars.has() returns true for schema scalars", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.scalars.has("DateTime")).toBe(true);
    expect(index.scalars.has("NonExistent")).toBe(false);
  });

  it("enums.has() returns true for schema enums", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.enums.has("Status")).toBe(true);
    expect(index.enums.has("NonExistent")).toBe(false);
  });

  it("inputs.has() returns true for schema inputs", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.inputs.has("UserFilter")).toBe(true);
    expect(index.inputs.has("NonExistent")).toBe(false);
  });

  it("objects.has() returns true for schema objects", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.objects.has("User")).toBe(true);
    expect(index.objects.has("Query")).toBe(true);
    expect(index.objects.has("NonExistent")).toBe(false);
  });

  it("unions.has() returns true for schema unions", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.unions.has("SearchResult")).toBe(true);
    expect(index.unions.has("NonExistent")).toBe(false);
  });

  it("operationTypes maps correctly", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.operationTypes.query).toBe("Query");
    expect(index.operationTypes.mutation).toBe("Mutation");
    expect(index.operationTypes.subscription).toBeUndefined();
  });

  it("directives map is empty", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.directives.size).toBe(0);
  });
});
