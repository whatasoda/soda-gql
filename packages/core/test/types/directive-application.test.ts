/**
 * Type-level tests for directive application.
 *
 * Tests that @skip and @include directives are type-safe.
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

describe("Directive application type safety", () => {
  describe("@skip directive", () => {
    it("accepts boolean literal for if argument", () => {
      const GetUser = gql(({ query, $var, $dir }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.name(),
              ...f.email(null, { directives: [$dir.skip({ if: true })] }),
            })),
          }),
        }),
      );

      // Test that operation compiles and produces expected input type
      type Input = typeof GetUser.$infer.input;
      type _TestInput = Expect<Extends<{ id: string }, Input>>;
      expect(true).toBe(true);
    });

    it("accepts variable reference for if argument", () => {
      const GetUser = gql(({ query, $var, $dir }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!"), ...$var("hideEmail").Boolean("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.name(),
              ...f.email(null, { directives: [$dir.skip({ if: $.hideEmail })] }),
            })),
          }),
        }),
      );

      type Input = typeof GetUser.$infer.input;
      // Both id and hideEmail are required
      type _TestInput = Expect<Extends<{ id: string; hideEmail: boolean }, Input>>;
      expect(true).toBe(true);
    });
  });

  describe("@include directive", () => {
    it("accepts boolean literal for if argument", () => {
      const GetUser = gql(({ query, $var, $dir }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.email(null, { directives: [$dir.include({ if: false })] }),
            })),
          }),
        }),
      );

      type Input = typeof GetUser.$infer.input;
      type _TestInput = Expect<Extends<{ id: string }, Input>>;
      expect(true).toBe(true);
    });

    it("accepts variable reference for if argument", () => {
      const GetUser = gql(({ query, $var, $dir }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!"), ...$var("showEmail").Boolean("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.email(null, { directives: [$dir.include({ if: $.showEmail })] }),
            })),
          }),
        }),
      );

      type Input = typeof GetUser.$infer.input;
      // Both id and showEmail are required
      type _TestInput = Expect<Extends<{ id: string; showEmail: boolean }, Input>>;
      expect(true).toBe(true);
    });
  });

  describe("Multiple directives", () => {
    it("allows multiple directives on a field", () => {
      const GetUser = gql(({ query, $var, $dir }) =>
        query.operation({
          name: "GetUser",
          variables: {
            ...$var("id").ID("!"),
            ...$var("showEmail").Boolean("!"),
            ...$var("skipAge").Boolean("!"),
          },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              // Multiple directives on same field
              ...f.email(null, {
                directives: [$dir.include({ if: $.showEmail }), $dir.skip({ if: $.skipAge })],
              }),
            })),
          }),
        }),
      );

      type Input = typeof GetUser.$infer.input;
      // All variables are required
      type _TestInput = Expect<Extends<{ id: string; showEmail: boolean; skipAge: boolean }, Input>>;
      expect(true).toBe(true);
    });
  });

  describe("Directives on nested fields", () => {
    it("applies directive to nested object field", () => {
      const GetUsers = gql(({ query, $var, $dir }) =>
        query.operation({
          name: "GetUsers",
          variables: { ...$var("limit").Int("?"), ...$var("includeEmail").Boolean("!") },
          fields: ({ f, $ }) => ({
            ...f.users({ limit: $.limit })(({ f }) => ({
              ...f.id(),
              ...f.name(),
              ...f.email(null, { directives: [$dir.include({ if: $.includeEmail })] }),
            })),
          }),
        }),
      );

      type Input = typeof GetUsers.$infer.input;
      // includeEmail is required, limit is optional
      type _TestHasIncludeEmail = Expect<Extends<{ includeEmail: boolean }, Input>>;
      expect(true).toBe(true);
    });
  });

  describe("Output type with directives", () => {
    it("includes fields with directives in output type", () => {
      const GetUser = gql(({ query, $var, $dir }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!"), ...$var("showEmail").Boolean("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.email(null, { directives: [$dir.include({ if: $.showEmail })] }),
            })),
          }),
        }),
      );

      type Output = typeof GetUser.$infer.output;
      type Expected = {
        user: { id: string; email: string | null | undefined } | null | undefined;
      };
      // Directive-conditional fields are still in the output type
      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });
  });
});
