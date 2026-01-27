/**
 * Type-level tests for Operation definition and type inference.
 *
 * Tests that operation definitions produce correct input/output types.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
import { type BasicSchema, basicInputTypeMethods, basicSchema } from "./_fixtures";
import type { EqualPublic, Expect, Extends } from "./_helpers";

const gql = createGqlElementComposer<BasicSchema, FragmentBuildersAll<BasicSchema>, StandardDirectives>(basicSchema, {
  inputTypeMethods: basicInputTypeMethods,
});

describe("Operation definition type inference", () => {
  describe("Query output type", () => {
    it("infers scalar fields in query result", () => {
      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          }),
        }),
      );

      type Output = typeof GetUser.$infer.output;
      type Expected = {
        user: { id: string; name: string } | null | undefined;
      };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });

    it("infers list fields in query result", () => {
      const GetUsers = gql(({ query }) =>
        query.operation({
          name: "GetUsers",
          fields: ({ f }) => ({
            ...f.users({})(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          }),
        }),
      );

      type Output = typeof GetUsers.$infer.output;
      // users: [User!]! -> Array<{ id: string; name: string }>
      type _TestIsArray = Expect<Extends<{ users: Array<{ id: string; name: string }> }, Output>>;
      expect(true).toBe(true);
    });
  });

  describe("Query input type (variables)", () => {
    it("infers required variable", () => {
      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      type Input = typeof GetUser.$infer.input;
      type _TestHasId = Expect<Extends<{ id: string }, Input>>;
      expect(true).toBe(true);
    });

    it("infers optional variable", () => {
      const GetUsers = gql(({ query, $var }) =>
        query.operation({
          name: "GetUsers",
          variables: { ...$var("limit").Int("?") },
          fields: ({ f, $ }) => ({
            ...f.users({ limit: $.limit })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      type Input = typeof GetUsers.$infer.input;
      // Optional variable allows omission - input can be empty or have the optional field
      type _TestAcceptsEmpty = Expect<Extends<{}, Input>>;
      // Optional variable field is optional in the object
      type _TestHasOptionalLimit = Expect<Extends<Input, { limit?: number | null | undefined }>>;
      expect(true).toBe(true);
    });

    it("infers multiple variables", () => {
      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: {
            ...$var("id").ID("!"),
            ...$var("limit").Int("?"),
          },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      type Input = typeof GetUser.$infer.input;
      // Required 'id', optional 'limit'
      type _TestHasId = Expect<Extends<{ id: string }, Input>>;
      expect(true).toBe(true);
    });
  });

  describe("Mutation type inference", () => {
    it("infers mutation input and output", () => {
      const UpdateUser = gql(({ mutation, $var }) =>
        mutation.operation({
          name: "UpdateUser",
          variables: {
            ...$var("id").ID("!"),
            ...$var("name").String("!"),
          },
          fields: ({ f, $ }) => ({
            ...f.updateUser({ id: $.id, name: $.name })(({ f }) => ({
              ...f.id(),
              ...f.name(),
            })),
          }),
        }),
      );

      type Input = typeof UpdateUser.$infer.input;
      type Output = typeof UpdateUser.$infer.output;

      // Input has both required variables
      type _TestInput = Expect<Extends<{ id: string; name: string }, Input>>;
      // Output has updateUser field (nullable)
      type _TestOutput = Expect<Extends<{ updateUser: { id: string; name: string } | null | undefined }, Output>>;
      expect(true).toBe(true);
    });
  });

  describe("Operation without variables", () => {
    it("infers empty input when no variables", () => {
      const GetUsers = gql(({ query }) =>
        query.operation({
          name: "GetUsers",
          fields: ({ f }) => ({
            ...f.users({})(({ f }) => ({
              ...f.id(),
            })),
          }),
        }),
      );

      type Input = typeof GetUsers.$infer.input;
      // Empty variables means empty object input
      type _TestEmptyInput = Expect<Extends<{}, Input>>;
      expect(true).toBe(true);
    });
  });
});
