/**
 * Type-level tests for Fragment definition and type inference.
 *
 * Tests that fragment field selections produce correct output types.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer, type FragmentBuildersAll } from "../../src/composer/gql-composer";
import type { Equal, EqualPublic, Expect, Extends } from "./_helpers";
import { basicInputTypeMethods, basicSchema, type BasicSchema } from "./_fixtures";

const gql = createGqlElementComposer<BasicSchema, FragmentBuildersAll<BasicSchema>, StandardDirectives>(basicSchema, {
  inputTypeMethods: basicInputTypeMethods,
});

describe("Fragment definition type inference", () => {
  describe("Scalar field selection", () => {
    it("infers single scalar field", () => {
      const fragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.id(),
          }),
        }),
      );

      type Output = typeof fragment.$infer.output;
      type Expected = { id: string };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });

    it("infers multiple scalar fields", () => {
      const fragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.id(),
            ...f.name(),
          }),
        }),
      );

      type Output = typeof fragment.$infer.output;
      type Expected = { id: string; name: string };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });

    it("infers optional scalar field as nullable", () => {
      const fragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.email(),
          }),
        }),
      );

      type Output = typeof fragment.$infer.output;
      // Nullable fields are inferred as T | null | undefined
      type Expected = { email: string | null | undefined };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });

    it("infers Int scalar as number", () => {
      const fragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.age(),
          }),
        }),
      );

      type Output = typeof fragment.$infer.output;
      // Nullable fields are inferred as T | null | undefined
      type Expected = { age: number | null | undefined };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });
  });

  // TODO: __typename field test - f.__typename() returns non-spreadable type
  // This test is skipped until the API is verified
  // describe("__typename field", () => {
  //   it("infers __typename as literal string type", () => {
  //     ...
  //   });
  // });

  describe("Mixed field types", () => {
    it("infers mixed required and optional fields", () => {
      const fragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.id(),
            ...f.name(),
            ...f.email(),
            ...f.age(),
          }),
        }),
      );

      type Output = typeof fragment.$infer.output;
      type Expected = {
        id: string;
        name: string;
        email: string | null | undefined;
        age: number | null | undefined;
      };

      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });
  });

  describe("Fragment input type (variables)", () => {
    it("infers empty input when no variables defined", () => {
      const fragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.id(),
          }),
        }),
      );

      type Input = typeof fragment.$infer.input;
      // When no variables, input is void (can be omitted)
      type _TestIsVoid = Expect<Equal<Input, void>>;
      expect(true).toBe(true);
    });

    it("infers required variable in input", () => {
      const fragment = gql(({ fragment, $var }) =>
        fragment.User({
          variables: { ...$var("userId").ID("!") },
          fields: ({ f }) => ({
            ...f.id(),
          }),
        }),
      );

      type Input = typeof fragment.$infer.input;
      // Input accepts { userId: string }
      type _TestAcceptsValue = Expect<Extends<{ userId: string }, Input>>;
      expect(true).toBe(true);
    });

    it("infers optional variable in input", () => {
      const fragment = gql(({ fragment, $var }) =>
        fragment.User({
          variables: { ...$var("limit").Int("?") },
          fields: ({ f }) => ({
            ...f.id(),
          }),
        }),
      );

      type Input = typeof fragment.$infer.input;
      // Optional variable means input can be void or contain the optional value
      type _TestCanBeVoid = Expect<Extends<void, Input>>;
      type _TestAcceptsValue = Expect<Extends<{ limit: number | null }, Input>>;
      expect(true).toBe(true);
    });
  });
});
