# SchemaIndex-AnyGraphqlSchema Adapter Design

## Purpose

Provide a conversion function `createSchemaIndexFromSchema` that builds a minimal `SchemaIndex` from `AnyGraphqlSchema`. This enables the composer layer (which operates on `AnyGraphqlSchema`) to call shared utilities like `buildVarSpecifier` that require `SchemaIndex`.

**Parent plan**: [Phase 1 Implementation Plan](./tagged-template-unification-phase1.md)

## Problem

- `buildVarSpecifier(node: VariableDefinitionNode, schema: SchemaIndex)` resolves type kind (scalar/enum/input) via `schema.scalars.has()`, `schema.enums.has()`, `schema.inputs.has()`
- The composer layer only has `AnyGraphqlSchema` (object-based, soda-gql domain types)
- The codegen layer uses `SchemaIndex` (Map-based, from graphql-js DocumentNode)
- No conversion exists between these two types

## Design

```typescript
// packages/core/src/graphql/schema-adapter.ts

import type { SchemaIndex } from "./schema-index";
import type { AnyGraphqlSchema } from "../types/schema/schema";

/**
 * Create a minimal SchemaIndex from AnyGraphqlSchema.
 *
 * IMPORTANT: This adapter produces a "name-resolution only" SchemaIndex.
 * Only the name-level Maps are populated (.has() lookups work).
 * Field-level data (FieldDefinitionNode, InputValueDefinitionNode, etc.)
 * is NOT populated -- those Maps are empty.
 *
 * Use this when you need SchemaIndex for type kind resolution only
 * (e.g., buildVarSpecifier). For full SchemaIndex with field-level data,
 * use createSchemaIndex(DocumentNode) from schema-index.ts.
 */
export const createSchemaIndexFromSchema = (
  schema: AnyGraphqlSchema,
): SchemaIndex => {
  const scalars = new Map(
    Object.keys(schema.scalar).map((n) => [n, { name: n, directives: [] }]),
  );
  const enums = new Map(
    Object.keys(schema.enum).map((n) => [
      n,
      { name: n, values: new Map(), directives: [] },
    ]),
  );
  const inputs = new Map(
    Object.keys(schema.input).map((n) => [
      n,
      { name: n, fields: new Map(), directives: [] },
    ]),
  );
  const objects = new Map(
    Object.keys(schema.object).map((n) => [
      n,
      { name: n, fields: new Map(), directives: [] },
    ]),
  );
  const unions = new Map(
    Object.keys(schema.union).map((n) => [
      n,
      { name: n, members: new Map(), directives: [] },
    ]),
  );
  return {
    objects,
    inputs,
    enums,
    unions,
    scalars,
    directives: new Map(),
    operationTypes: {
      query: schema.operations.query ?? undefined,
      mutation: schema.operations.mutation ?? undefined,
      subscription: schema.operations.subscription ?? undefined,
    },
  };
};
```

## Usage in Round 2/3

```typescript
// In operation-tagged-template.ts, fragment-tagged-template.ts, extend.ts
import { createSchemaIndexFromSchema } from "../graphql/schema-adapter";
import { buildVarSpecifier } from "../graphql/var-specifier-builder";

// Convert AnyGraphqlSchema to SchemaIndex for buildVarSpecifier
const schemaIndex = createSchemaIndexFromSchema(schema);
const varSpec = buildVarSpecifier(varDefNode, schemaIndex);
```

## Test Specification

```typescript
describe("createSchemaIndexFromSchema", () => {
  const schema: AnyGraphqlSchema = {
    label: "test",
    operations: { query: "Query", mutation: "Mutation" },
    scalar: { DateTime: { /* ... */ } },
    enum: { Status: { /* ... */ } },
    input: { UserFilter: { /* ... */ } },
    object: { User: { /* ... */ }, Query: { /* ... */ } },
    union: { SearchResult: { /* ... */ } },
  };

  it("scalars.has() returns true for schema scalars", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.scalars.has("DateTime")).toBe(true);
    expect(index.scalars.has("NonExistent")).toBe(false);
  });

  it("enums.has() returns true for schema enums", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.enums.has("Status")).toBe(true);
  });

  it("inputs.has() returns true for schema inputs", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.inputs.has("UserFilter")).toBe(true);
  });

  it("objects.has() returns true for schema objects", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.objects.has("User")).toBe(true);
  });

  it("unions.has() returns true for schema unions", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.unions.has("SearchResult")).toBe(true);
  });

  it("operationTypes maps correctly", () => {
    const index = createSchemaIndexFromSchema(schema);
    expect(index.operationTypes.query).toBe("Query");
    expect(index.operationTypes.mutation).toBe("Mutation");
    expect(index.operationTypes.subscription).toBeUndefined();
  });
});
```

## Scope Limitation

This adapter is intentionally **name-resolution only**:
- `Map.has()` works correctly for all type categories
- `Map.get()` returns records with `name` and `directives: []` but **empty field Maps**
- Do NOT use the adapter-produced SchemaIndex for field-level lookups (use `createSchemaIndex(DocumentNode)` instead)
