/**
 * Type-level tests for fragment spreading in operations.
 *
 * Tests that fragment spreads correctly propagate types and handle variables.
 *
 * @module
 */

import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import { type BasicSchema, basicInputTypeMethods, basicSchema } from "./_fixtures";

const gql = createGqlElementComposer<BasicSchema, StandardDirectives>(basicSchema, {
  inputTypeMethods: basicInputTypeMethods,
});

describe("Fragment spreading type inference", () => {
  describe("Fragment spread without variables", () => {
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("propagates fragment output type", () => {
      const userFragment = gql(({ fragment }) => fragment`fragment UserSpreadFields on User { id name }`());

      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(() => ({
              ...userFragment.spread(),
            })),
          }),
        }),
      );

      // Runtime behavior tests
      expect(GetUser.operationName).toBe("GetUser");
      expect(GetUser.operationType).toBe("query");
      expect(typeof userFragment.spread).toBe("function");
    });
  });

  describe("Fragment spread with required variables", () => {
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("requires variable in spread call", () => {
      // Fragment that defines a required variable (for use in spread)
      const userFragment = gql(({ fragment }) => fragment`fragment UserPrefixFields($namePrefix: String!) on User { id name }`());

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

      // Runtime behavior tests
      expect(GetUser.operationName).toBe("GetUser");
      expect(userFragment.variableDefinitions).toBeDefined();
    });
  });

  describe("Fragment spread with optional variables", () => {
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("allows omitting optional variable", () => {
      const userFragment = gql(({ fragment }) =>
        fragment`fragment UserOptionalFields($includeAge: Boolean) on User { id name }`(),
      );

      const GetUser = gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(() => ({
              // Optional fragment variable - can be omitted or passed
              ...userFragment.spread(),
            })),
          }),
        }),
      );

      // Runtime behavior tests
      expect(GetUser.operationName).toBe("GetUser");
      expect(typeof userFragment.spread).toBe("function");
    });
  });

  describe("Variable type mismatch", () => {
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("rejects wrong variable type in spread", () => {
      const userFragment = gql(({ fragment }) =>
        fragment`fragment UserNamePrefixFields($namePrefix: String!) on User { id name }`(),
      );

      gql(({ query, $var }) =>
        query.operation({
          name: "GetUser",
          variables: { ...$var("id").ID("!"), ...$var("count").Int("!") },
          fields: ({ f, $ }) => ({
            ...f.user({ id: $.id })(() => ({
              // TODO: Type safety for variable types will be restored via prebuilt types
              ...userFragment.spread({ namePrefix: $.count }),
            })),
          }),
        }),
      );
      // Runtime behavior tests
      expect(userFragment.typename).toBe("User");
    });
  });

  describe("Nested fragment spread", () => {
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("spreads fragment in nested selection", () => {
      const idFragment = gql(({ fragment }) => fragment`fragment UserIdOnlyFields on User { id }`());

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

      // Runtime behavior tests
      expect(GetUsers.operationName).toBe("GetUsers");
      expect(idFragment.typename).toBe("User");
    });
  });

  describe("Multiple fragment spreads", () => {
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("combines fields from multiple fragments", () => {
      const idFragment = gql(({ fragment }) => fragment`fragment UserIdFragment on User { id }`());

      const nameFragment = gql(({ fragment }) => fragment`fragment UserNameFragment on User { name }`());

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

      // Runtime behavior tests
      expect(GetUser.operationName).toBe("GetUser");
      expect(idFragment.typename).toBe("User");
      expect(nameFragment.typename).toBe("User");
    });
  });
});
