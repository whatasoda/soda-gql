/**
 * Type-level tests for fragment spreading in operations.
 *
 * Tests that fragment spreads correctly propagate types and handle variables.
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

describe("Fragment spreading type inference", () => {
  describe("Fragment spread without variables", () => {
    it("propagates fragment output type", () => {
      const userFragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.id(),
            ...f.name(),
          }),
        }),
      );

      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...userFragment.spread(),
            })),
          }),
        }),
      );

      type Output = typeof GetUser.$infer.output;
      // Fragment fields (id, name) should be in the output
      type _Test = Expect<Extends<{ user: { id: string; name: string } | null | undefined }, Output>>;
      expect(true).toBe(true);
    });
  });

  describe("Fragment spread with required variables", () => {
    it("requires variable in spread call", () => {
      // Fragment that defines a required variable (for use in spread)
      const userFragment = gql(({ fragment, $var }) =>
        fragment.User({
          variables: { ...$var("namePrefix").String("!") },
          fields: ({ f }) => ({
            ...f.id(),
            ...f.name(),
          }),
        }),
      );

      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!"), ...$var("prefix").String("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(() => ({
              ...userFragment.spread({ namePrefix: $.prefix }),
            })),
          }),
        }),
      );

      type Output = typeof GetUser.$infer.output;
      // Output includes fragment fields
      type _TestOutput = Expect<Extends<{ user: { id: string; name: string } | null | undefined }, Output>>;

      type Input = typeof GetUser.$infer.input;
      // Input requires both operation variable and the one passed to fragment
      type _TestInput = Expect<Extends<{ id: string; prefix: string }, Input>>;
      expect(true).toBe(true);
    });
  });

  describe("Fragment spread with optional variables", () => {
    it("allows omitting optional variable", () => {
      const userFragment = gql(({ fragment, $var }) =>
        fragment.User({
          variables: { ...$var("includeAge").Boolean("?") },
          fields: ({ f }) => ({
            ...f.id(),
            ...f.name(),
          }),
        }),
      );

      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              // Optional fragment variable - can be omitted or passed
              ...userFragment.spread(),
            })),
          }),
        }),
      );

      type Output = typeof GetUser.$infer.output;
      type _Test = Expect<Extends<{ user: { id: string; name: string } | null | undefined }, Output>>;
      expect(true).toBe(true);
    });
  });

  describe("Variable type mismatch", () => {
    it("rejects wrong variable type in spread", () => {
      const userFragment = gql(({ fragment, $var }) =>
        fragment.User({
          variables: { ...$var("namePrefix").String("!") },
          fields: ({ f }) => ({
            ...f.id(),
            ...f.name(),
          }),
        }),
      );

      gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!"), ...$var("count").Int("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(() => ({
              // @ts-expect-error - Int variable cannot be assigned to String fragment variable
              ...userFragment.spread({ namePrefix: $.count }),
            })),
          }),
        }),
      );
      expect(true).toBe(true);
    });
  });

  describe("Nested fragment spread", () => {
    it("spreads fragment in nested selection", () => {
      const idFragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.id(),
          }),
        }),
      );

      const GetUsers = gql(({ query, $var }) =>
        query.operation({
          name: "GetUsers",
          variables: { ...$var("limit").Int("?") },
          fields: ({ f, $ }) => ({
            ...f.users({ limit: $.limit })(({ f }) => ({
              ...idFragment.spread(),
              ...f.name(),
            })),
          }),
        }),
      );

      type Output = typeof GetUsers.$infer.output;
      // Users is a list with id from fragment and name from direct selection
      type _Test = Expect<Extends<{ users: Array<{ id: string; name: string }> }, Output>>;
      expect(true).toBe(true);
    });
  });

  describe("Multiple fragment spreads", () => {
    it("combines fields from multiple fragments", () => {
      const idFragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.id(),
          }),
        }),
      );

      const nameFragment = gql(({ fragment }) =>
        fragment.User({
          fields: ({ f }) => ({
            ...f.name(),
          }),
        }),
      );

      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(({ f }) => ({
              ...idFragment.spread(),
              ...nameFragment.spread(),
              ...f.email(),
            })),
          }),
        }),
      );

      type Output = typeof GetUser.$infer.output;
      type Expected = {
        user: { id: string; name: string; email: string | null | undefined } | null | undefined;
      };
      type _Test = Expect<EqualPublic<Output, Expected>>;
      expect(true).toBe(true);
    });
  });
});
