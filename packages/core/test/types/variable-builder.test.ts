/**
 * Type-level tests for variable builder ($var) type checking.
 *
 * Tests that variable definitions are type-safe and type mismatches are detected.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
import type { Equal, Expect, Extends } from "./_helpers";
import {
  enumInputTypeMethods,
  enumSchema,
  type EnumSchema,
  inputObjectInputTypeMethods,
  inputObjectSchema,
  type InputObjectSchema,
} from "./_fixtures";

const enumGql = createGqlElementComposer<EnumSchema, FragmentBuildersAll<EnumSchema>, StandardDirectives>(enumSchema, {
  inputTypeMethods: enumInputTypeMethods,
});

const inputGql = createGqlElementComposer<InputObjectSchema, FragmentBuildersAll<InputObjectSchema>, StandardDirectives>(
  inputObjectSchema,
  { inputTypeMethods: inputObjectInputTypeMethods },
);

describe("Variable builder type safety", () => {
  describe("Scalar variable creation", () => {
    it("creates ID variable with required modifier", () => {
      const op = enumGql(({ query, $var }) =>
        query.operation({
          name: "Test",
          variables: { ...$var("userId").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.userId })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      type Input = typeof op.$infer.input;
      type _Test = Expect<Extends<{ userId: string }, Input>>;
      expect(true).toBe(true);
    });

    it("creates Int variable with optional modifier", () => {
      const op = inputGql(({ query, $var }) =>
        query.operation({
          name: "Test",
          variables: { ...$var("limit").Int("?") },
          fields: ({ f, $ }) => ({
            ...f.users({ limit: $.limit })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      type Input = typeof op.$infer.input;
      // Optional variable creates optional field
      type _Test = Expect<Extends<Input, { limit?: number | null | undefined }>>;
      expect(true).toBe(true);
    });
  });

  describe("Enum variable creation", () => {
    it("creates enum variable", () => {
      const op = enumGql(({ query, $var }) =>
        query.operation({
          name: "GetUsers",
          variables: { ...$var("role").UserRole("?") },
          fields: ({ f, $ }) => ({
            ...f.users({ role: $.role })(({ f }) => ({
              ...f.id(),
              ...f.role(),
            })),
          }),
        }),
      );

      type Input = typeof op.$infer.input;
      // Enum variable is optional
      type _Test = Expect<Extends<Input, { role?: "ADMIN" | "USER" | "GUEST" | null | undefined }>>;
      expect(true).toBe(true);
    });
  });

  describe("Enum output type inference", () => {
    it("infers enum field output as union literal type", () => {
      const op = enumGql(({ query, $var }) =>
        query.operation({
          name: "GetUsersWithRole",
          variables: { ...$var("role").UserRole("?") },
          fields: ({ f, $ }) => ({
            ...f.users({ role: $.role })(({ f }) => ({
              ...f.id(),
              ...f.role(),
            })),
          }),
        }),
      );

      type Output = typeof op.$infer.output;
      type UserRole = NonNullable<Output["users"]>[number]["role"];

      // Enum output should be union literal type, not just string
      type _TestIsLiteral = Expect<Equal<UserRole, "ADMIN" | "USER" | "GUEST">>;
      expect(true).toBe(true);
    });
  });

  describe("Input object variable creation", () => {
    it("creates input object variable", () => {
      const op = inputGql(({ mutation, $var }) =>
        mutation.operation({
          name: "CreateUser",
          variables: { ...$var("input").CreateUserInput("!") },
          fields: ({ f, $ }) => ({
            ...f.createUser({ input: $.input })(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          }),
        }),
      );

      type Input = typeof op.$infer.input;
      // Input object variable accepts the input type shape
      type _Test = Expect<
        Extends<
          {
            input: {
              name: string;
              email: string;
              age?: number | null | undefined;
            };
          },
          Input
        >
      >;
      expect(true).toBe(true);
    });
  });

  describe("Type mismatch detection", () => {
    it("rejects wrong scalar type for argument", () => {
      // This test documents that type mismatches are detected at compile time
      // Using Int variable where ID is expected should cause type error
      enumGql(({ query, $var }) =>
        query.operation({
          name: "Test",
          variables: { ...$var("userId").Int("!") }, // Int instead of ID
          fields: ({ f, $ }) => ({
            // @ts-expect-error - Int variable cannot be assigned to ID argument
            ...f.user({ id: $.userId })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );
      expect(true).toBe(true);
    });

    it("rejects wrong enum type for argument", () => {
      // Using PostStatus where UserRole is expected
      enumGql(({ query, $var }) =>
        query.operation({
          name: "Test",
          variables: { ...$var("status").PostStatus("?") }, // PostStatus instead of UserRole
          fields: ({ f, $ }) => ({
            // @ts-expect-error - PostStatus variable cannot be assigned to UserRole argument
            ...f.users({ role: $.status })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );
      expect(true).toBe(true);
    });
  });

  describe("List modifier handling", () => {
    it("creates list variable", () => {
      // Note: This test verifies list modifier syntax works
      // The actual list field would need to be defined in the schema
      const op = inputGql(({ query, $var }) =>
        query.operation({
          name: "Test",
          variables: { ...$var("ids").ID("![]!") }, // List of required IDs
          fields: ({ f }) => ({
            ...f.users({})(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      type Input = typeof op.$infer.input;
      // List variable accepts array
      type _Test = Expect<Extends<{ ids: string[] }, Input>>;
      expect(true).toBe(true);
    });
  });
});
