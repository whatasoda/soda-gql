/**
 * Type-level tests for field alias handling.
 *
 * Tests that field aliases correctly appear as property names in output types.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
import type { EqualPublic, Expect } from "./_helpers";
import { basicInputTypeMethods, basicSchema, type BasicSchema } from "./_fixtures";

const gql = createGqlElementComposer<BasicSchema, FragmentBuildersAll<BasicSchema>, StandardDirectives>(basicSchema, {
  inputTypeMethods: basicInputTypeMethods,
});

describe("Alias handling in type inference", () => {
  describe("Simple alias", () => {
    it("uses alias option to set property name", () => {
      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              // Use alias option: f.field(args, { alias: "newName" })
              ...f.id(null, { alias: "userId" }),
              ...f.name(null, { alias: "userName" }),
            })),
          }),
        }),
      );

      type Output = typeof GetUser.$infer.output;
      type Expected = {
        user: { userId: string; userName: string } | null | undefined;
      };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });
  });

  describe("Mixed alias and non-alias", () => {
    it("preserves field names when no alias used", () => {
      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(), // No alias, uses 'id'
              ...f.name(null, { alias: "userName" }), // Alias, uses 'userName'
            })),
          }),
        }),
      );

      type Output = typeof GetUser.$infer.output;
      type Expected = {
        user: { id: string; userName: string } | null | undefined;
      };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });
  });

  describe("Type preservation with alias", () => {
    it("preserves nullable type with alias", () => {
      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...f.id(),
              ...f.email(null, { alias: "userEmail" }), // email is nullable
            })),
          }),
        }),
      );

      type Output = typeof GetUser.$infer.output;
      type Expected = {
        user: { id: string; userEmail: string | null | undefined } | null | undefined;
      };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });
  });
});
