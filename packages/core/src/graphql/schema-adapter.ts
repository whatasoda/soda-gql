/**
 * Adapter to create a minimal SchemaIndex from AnyGraphqlSchema.
 * Only name-level Maps are populated (.has() lookups work).
 * Field-level data is NOT populated.
 * @module
 */

import type { AnyGraphqlSchema } from "../types/schema/schema";
import type { SchemaIndex } from "./schema-index";

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
export const createSchemaIndexFromSchema = (schema: AnyGraphqlSchema): SchemaIndex => {
  const scalars: SchemaIndex["scalars"] = new Map(
    Object.keys(schema.scalar).map((n) => [n, { name: n, directives: [] }]),
  );
  const enums: SchemaIndex["enums"] = new Map(
    Object.keys(schema.enum).map((n) => [n, { name: n, values: new Map(), directives: [] }]),
  );
  const inputs: SchemaIndex["inputs"] = new Map(
    Object.keys(schema.input).map((n) => [n, { name: n, fields: new Map(), directives: [] }]),
  );
  const objects: SchemaIndex["objects"] = new Map(
    Object.keys(schema.object).map((n) => [n, { name: n, fields: new Map(), directives: [] }]),
  );
  const unions: SchemaIndex["unions"] = new Map(
    Object.keys(schema.union).map((n) => [n, { name: n, members: new Map(), directives: [] }]),
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
