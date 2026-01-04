import { describe, expect, it } from "bun:test";
import { define, defineScalar, unsafeInputType, unsafeOutputType } from "../schema";
import type { AssignableInput, DeclaredVariables } from "./fragment/assignable-input";
import type { AnyGraphqlSchema } from "./schema";
import { createVarRefFromVariable } from "./type-foundation/var-ref";

/**
 * Type error examples for documentation and regression testing.
 *
 * This file demonstrates common type errors in soda-gql and verifies that
 * error messages are user-friendly. Each example shows:
 * 1. The correct usage pattern
 * 2. The error case with @ts-expect-error
 * 3. Comments explaining what the error message should look like
 *
 * If any @ts-expect-error becomes unused, it means either:
 * - The type system changed and the error is no longer detected
 * - The error moved to a different location
 * Both cases should be investigated.
 */

// Test schema with various field types
const createTestSchema = () =>
  ({
    label: "error_examples" as const,
    operations: {
      query: "Query" as const,
      mutation: null,
      subscription: null,
    },
    scalar: {
      ...defineScalar<"ID", string, string>("ID"),
      ...defineScalar<"String", string, string>("String"),
      ...defineScalar<"Int", number, number>("Int"),
    },
    enum: {},
    input: {
      Filter: define("Filter").input({
        id: unsafeInputType.scalar("ID:!", {}),
        name: unsafeInputType.scalar("String:?", {}),
      }),
    },
    object: {
      Query: define("Query").object({
        // Required ID argument
        user: unsafeOutputType.object("User:?", {
          arguments: {
            id: unsafeInputType.scalar("ID:!", {}),
          },
        }),
        // Optional ID argument
        optionalUser: unsafeOutputType.object("User:?", {
          arguments: {
            id: unsafeInputType.scalar("ID:?", {}),
          },
        }),
        // List argument
        users: unsafeOutputType.object("User:![]!", {
          arguments: {
            ids: unsafeInputType.scalar("ID:![]?", {}),
          },
        }),
        // String argument (for type mismatch tests)
        userByName: unsafeOutputType.object("User:?", {
          arguments: {
            name: unsafeInputType.scalar("String:!", {}),
          },
        }),
      }),
      User: define("User").object({
        id: unsafeOutputType.scalar("ID:!", {}),
        name: unsafeOutputType.scalar("String:!", {}),
      }),
    },
    union: {},
  }) satisfies AnyGraphqlSchema;

type TestSchema = ReturnType<typeof createTestSchema>;

describe("Type error examples for documentation", () => {
  describe("Variable modifier mismatch (nullability)", () => {
    it("allows required variable to optional argument (covariance)", () => {
      // VarRef is untyped at creation, but typed at assignment
      const requiredIdVar = createVarRefFromVariable("id");

      // This should compile: Required (!) -> Optional (?) is allowed
      // TypeScript's structural typing allows this because ! is a subtype of ?
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["optionalUser"]["arguments"]> = {
        id: requiredIdVar,
      };
      expect(true).toBe(true);
    });

    it("rejects optional variable to required argument", () => {
      // Create variables with different modifiers
      // Note: createVarRefFromVariable returns AnyVarRef, so we need to cast through DeclaredVariables
      type OptionalIdVars = DeclaredVariables<
        TestSchema,
        { id: { kind: "scalar"; name: "ID"; modifier: "?"; defaultValue: null; directives: {} } }
      >;
      const $ = { id: createVarRefFromVariable("id") } as unknown as OptionalIdVars;

      // Optional (?) variable cannot be assigned to required (!) argument
      // Error includes: Type 'Signature_Optional' is not assignable to type 'Signature_Required'
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["user"]["arguments"]> = {
        // @ts-expect-error
        id: $.id,
      };
      expect(true).toBe(true);
    });
  });

  describe("Variable type name mismatch", () => {
    it("rejects wrong type name (Int -> ID)", () => {
      // Declare a variable with Int type
      type IntVars = DeclaredVariables<
        TestSchema,
        { userId: { kind: "scalar"; name: "Int"; modifier: "!"; defaultValue: null; directives: {} } }
      >;
      const $ = { userId: createVarRefFromVariable("userId") } as unknown as IntVars;

      // Int variable cannot be assigned to ID argument
      // Error includes: Type '"Int"' is not assignable to type '"ID"'
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["user"]["arguments"]> = {
        // @ts-expect-error
        id: $.userId,
      };
      expect(true).toBe(true);
    });

    it("rejects wrong type name (ID -> String)", () => {
      type IdVars = DeclaredVariables<
        TestSchema,
        { id: { kind: "scalar"; name: "ID"; modifier: "!"; defaultValue: null; directives: {} } }
      >;
      const $ = { id: createVarRefFromVariable("id") } as unknown as IdVars;

      // ID variable cannot be assigned to String argument
      // Error includes: Type '"ID"' is not assignable to type '"String"'
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["userByName"]["arguments"]> = {
        // @ts-expect-error
        name: $.id,
      };
      expect(true).toBe(true);
    });
  });

  describe("List modifier mismatch", () => {
    it("rejects single value to list argument", () => {
      // Declare a single ID variable (not a list)
      type SingleIdVars = DeclaredVariables<
        TestSchema,
        { id: { kind: "scalar"; name: "ID"; modifier: "!"; defaultValue: null; directives: {} } }
      >;
      const $ = { id: createVarRefFromVariable("id") } as unknown as SingleIdVars;

      // Single ID (!) cannot be assigned to list argument ([ID!]?)
      // Error includes: Type 'Signature_Required' is not assignable to type 'Signature_RequiredList_Optional'
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["users"]["arguments"]> = {
        // @ts-expect-error
        ids: $.id,
      };
      expect(true).toBe(true);
    });

    it("allows list variable to list argument", () => {
      // Declare a list ID variable
      type ListIdVars = DeclaredVariables<
        TestSchema,
        { ids: { kind: "scalar"; name: "ID"; modifier: "![]?"; defaultValue: null; directives: {} } }
      >;
      const $ = { ids: createVarRefFromVariable("ids") } as unknown as ListIdVars;

      // This should compile: [ID!]? -> [ID!]? is allowed
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["users"]["arguments"]> = {
        ids: $.ids,
      };
      expect(true).toBe(true);
    });
  });

  describe("Missing required fields", () => {
    it("detects missing required argument", () => {
      // Required field 'id' is missing
      // Error includes: Property 'id' is missing in type '{}'
      // @ts-expect-error
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["user"]["arguments"]> = {};
      expect(true).toBe(true);
    });

    it("allows omitting optional arguments", () => {
      // This should compile: optional arguments can be omitted
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["optionalUser"]["arguments"]> = {};
      expect(true).toBe(true);
    });
  });

  describe("Const value type mismatch", () => {
    it("rejects wrong const value type", () => {
      // number is not assignable to ID (string)
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["user"]["arguments"]> = {
        // @ts-expect-error
        id: 123,
      };
      expect(true).toBe(true);
    });

    it("accepts correct const value type", () => {
      // This should compile: string is assignable to ID
      const _input: AssignableInput<TestSchema, TestSchema["object"]["Query"]["fields"]["user"]["arguments"]> = {
        id: "user-123",
      };
      expect(true).toBe(true);
    });
  });
});
