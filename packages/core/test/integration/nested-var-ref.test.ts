import { describe, expect, it } from "bun:test";
import { type FragmentBuildersAll, createGqlElementComposer } from "../../src/composer/gql-composer";
import { createVarMethodFactory, type InputTypeMethods } from "../../src/composer/var-builder";
import { define, defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import { unsafeInputType, unsafeOutputType } from "../../src/schema/type-specifier-builder";
import type { OperationMetadata } from "../../src/types/metadata";
import type { AnyGraphqlSchema } from "../../src/types/schema";
import { createVarRefFromNestedValue, createVarRefFromVariable } from "../../src/types/type-foundation/var-ref";

const schema = {
  label: "test" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", number, number>("Int"),
    ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  },
  enum: {},
  input: {
    Filter: define("Filter").input({
      id: unsafeInputType.scalar("ID:!", {}),
      name: unsafeInputType.scalar("String:!", {}),
      age: unsafeInputType.scalar("Int:?", {}),
    }),
  },
  object: {
    Query: define("Query").object({
      user: unsafeOutputType.object("User:!", {
        arguments: {
          id: unsafeInputType.scalar("ID:!", {}),
        },
      }),
    }),
    Mutation: define("Mutation").object({}),
    Subscription: define("Subscription").object({}),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      age: unsafeOutputType.scalar("Int:?", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

type Schema = typeof schema & { _?: never };

const createMethod = createVarMethodFactory<Schema>();
const inputTypeMethods = {
  Boolean: createMethod("scalar", "Boolean"),
  ID: createMethod("scalar", "ID"),
  Int: createMethod("scalar", "Int"),
  String: createMethod("scalar", "String"),
  Filter: createMethod("input", "Filter"),
} satisfies InputTypeMethods<Schema>;

describe("nested VarRef with $var helpers", () => {
  describe("$var.getNameAt", () => {
    it("extracts variable name from nested structure in metadata", () => {
      const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>>(schema, { inputTypeMethods });

      // Create a nested structure with a VarRef inside
      const userIdVarRef = createVarRefFromVariable("userId");
      const nestedRef = createVarRefFromNestedValue({
        filter: {
          id: userIdVarRef,
          name: "Alice",
        },
      });

      const operation = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("userId").ID("!") },
          metadata: () => ({
            custom: {
              // Use getNameAt to extract variable name from nested structure
              extractedVarName: $var.getNameAt(nestedRef, (p: any) => p.filter.id),
            },
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.extractedVarName).toBe("userId");
    });
  });

  describe("$var.getValueAt", () => {
    it("extracts const value from nested structure in metadata", () => {
      const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>>(schema, { inputTypeMethods });

      // Create a nested structure with const values and a VarRef
      const userIdVarRef = createVarRefFromVariable("userId");
      const nestedRef = createVarRefFromNestedValue({
        filter: {
          id: userIdVarRef,
          name: "Alice",
          age: 30,
        },
      });

      const operation = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("userId").ID("!") },
          metadata: () => ({
            custom: {
              // Use getValueAt to extract const value from nested structure
              extractedName: $var.getValueAt(nestedRef, (p: any) => p.filter.name),
              extractedAge: $var.getValueAt(nestedRef, (p: any) => p.filter.age),
            },
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.extractedName).toBe("Alice");
      expect(meta.custom?.extractedAge).toBe(30);
    });
  });

  describe("mixed nested VarRef usage", () => {
    it("handles nested structure with both VarRef and const values", () => {
      const gql = createGqlElementComposer<Schema, FragmentBuildersAll<Schema>>(schema, { inputTypeMethods });

      const ageVarRef = createVarRefFromVariable("userAge");
      const nestedRef = createVarRefFromNestedValue({
        user: {
          name: "Bob",
          age: ageVarRef,
        },
      });

      const operation = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("userId").ID("!"), ...$var("userAge").Int("?") },
          metadata: () => ({
            custom: {
              constName: $var.getValueAt(nestedRef, (p: any) => p.user.name),
              varAgeName: $var.getNameAt(nestedRef, (p: any) => p.user.age),
            },
          }),
          fields: ({ f, $ }) => ({ ...f.user({ id: $.userId })(({ f }) => ({ ...f.id() })) }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.constName).toBe("Bob");
      expect(meta.custom?.varAgeName).toBe("userAge");
    });
  });
});
