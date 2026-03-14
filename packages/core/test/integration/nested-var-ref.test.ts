import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { defineOperationRoots, defineScalar } from "../../src/schema/schema-builder";
import type { OperationMetadata } from "../../src/types/metadata";
import type { MinimalSchema } from "../../src/types/schema";
import { createVarRefFromNestedValue, createVarRefFromVariable } from "../../src/types/type-foundation/var-ref";
import { define, unsafeInputType, unsafeOutputType } from "../utils/schema";
import { getNameAt, getValueAt } from "../../src/composer/var-ref-tools";

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
  typeNames: { scalar: ["ID", "String", "Int", "Boolean"], enum: [], input: [] },
} satisfies MinimalSchema;

type Schema = typeof schema & { _?: never };


// NOTE: The `(p: any)` annotations in getNameAt/getValueAt/getVariablePath selectors below
// are intentional and cannot be removed. These tests use VarRefs created via
// `createVarRefFromNestedValue` (which returns `AnyVarRef`) rather than the schema-aware
// `$.varName` references. The runtime functions `getNameAt`/`getValueAt`/`getVariablePath` in
// var-ref-tools.ts use the signature `<T, U>(varRef: VarRef<AnyVarRefBrand>, selector: (proxy: T) => U)`,
// where `T` has no constraint tying it to the VarRef's brand. As a result, TypeScript infers
// `T` as `unknown`, making property access impossible without the `any` annotation.
//
// The schema-aware proxy typing (via `SchemaAwareGetValueAt`) only works when using the
// `getValueAt($.varName, ...)` pattern inside a gql composer callback, where the VarRef
// is a `DeclaredVariables` reference with a concrete brand. See the type-level tests in
// `packages/core/test/types/var-ref-tools.test.ts` for verification of schema-aware inference.
describe("nested VarRef with var-ref-tools helpers", () => {
  describe("getNameAt", () => {
    it("extracts variable name from nested structure in metadata", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      // Create a nested structure with a VarRef inside
      const userIdVarRef = createVarRefFromVariable("userId");
      const nestedRef = createVarRefFromNestedValue({
        filter: {
          id: userIdVarRef,
          name: "Alice",
        },
      });

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) })
        })({
          metadata: () => ({
            custom: {
              // Use getNameAt to extract variable name from nested structure
              extractedVarName: getNameAt(nestedRef, (p: any) => p.filter.id),
            },
          }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.extractedVarName).toBe("userId");
    });
  });

  describe("getValueAt", () => {
    it("extracts const value from nested structure in metadata", () => {
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      // Create a nested structure with const values and a VarRef
      const userIdVarRef = createVarRefFromVariable("userId");
      const nestedRef = createVarRefFromNestedValue({
        filter: {
          id: userIdVarRef,
          name: "Alice",
          age: 30,
        },
      });

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) })
        })({
          metadata: () => ({
            custom: {
              // Use getValueAt to extract const value from nested structure
              extractedName: getValueAt(nestedRef, (p: any) => p.filter.name),
              extractedAge: getValueAt(nestedRef, (p: any) => p.filter.age),
            },
          }),
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
      const gql = createGqlElementComposer<Schema, StandardDirectives>(schema, {});

      const ageVarRef = createVarRefFromVariable("userAge");
      const nestedRef = createVarRefFromNestedValue({
        user: {
          name: "Bob",
          age: ageVarRef,
        },
      });

      const operation = gql(({ query }) =>
        query("GetUser")({
          variables: `($userId: ID!, $userAge: Int)`,
          fields: ({ f, $ }) => ({ ...f("user", { id: $.userId })(({ f }) => ({ ...f("id")() })) })
        })({
          metadata: () => ({
            custom: {
              constName: getValueAt(nestedRef, (p: any) => p.user.name),
              varAgeName: getNameAt(nestedRef, (p: any) => p.user.age),
            },
          }),
        }),
      );

      expect(operation.metadata).toBeDefined();
      const meta = operation.metadata as OperationMetadata;
      expect(meta.custom?.constName).toBe("Bob");
      expect(meta.custom?.varAgeName).toBe("userAge");
    });
  });
});
