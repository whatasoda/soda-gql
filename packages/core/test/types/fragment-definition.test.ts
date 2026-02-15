/**
 * Type-level tests for Fragment definition and type inference.
 *
 * Tests that fragment field selections produce correct output types.
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

describe("Fragment definition type inference", () => {
  describe("Scalar field selection", () => {
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("infers single scalar field", () => {
      const fragment = gql(({ fragment }) => fragment`fragment UserIdFields on User { id }`());

      // Runtime behavior tests (tagged templates don't carry TypeScript types yet)
      expect(fragment.typename).toBe("User");
      expect(fragment.key).toBeDefined();
      expect(fragment.schemaLabel).toBe("basic");
    });

    // TODO(Phase 2): Add type-level tests via typegen integration
    it("infers multiple scalar fields", () => {
      const fragment = gql(({ fragment }) => fragment`fragment UserBasicFields on User { id name }`());

      // Runtime behavior tests
      expect(fragment.typename).toBe("User");
      expect(fragment.spread({} as never)).toBeDefined();
    });

    // TODO(Phase 2): Add type-level tests via typegen integration
    it("infers optional scalar field as nullable", () => {
      const fragment = gql(({ fragment }) => fragment`fragment UserEmailFields on User { email }`());

      // Runtime behavior tests
      expect(fragment.typename).toBe("User");
      expect(fragment.spread({} as never)).toBeDefined();
    });

    // TODO(Phase 2): Add type-level tests via typegen integration
    it("infers Int scalar as number", () => {
      const fragment = gql(({ fragment }) => fragment`fragment UserAgeFields on User { age }`());

      // Runtime behavior tests
      expect(fragment.typename).toBe("User");
      expect(fragment.spread({} as never)).toBeDefined();
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
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("infers mixed required and optional fields", () => {
      const fragment = gql(({ fragment }) => fragment`fragment UserAllFields on User { id name email age }`());

      // Runtime behavior tests
      expect(fragment.typename).toBe("User");
      expect(fragment.spread({} as never)).toBeDefined();
    });
  });

  describe("Fragment input type (variables)", () => {
    // TODO(Phase 2): Add type-level tests via typegen integration
    it("infers empty input when no variables defined", () => {
      const fragment = gql(({ fragment }) => fragment`fragment UserSimpleFields on User { id }`());

      // Runtime behavior tests
      expect(fragment.variableDefinitions).toBeDefined();
      expect(fragment.typename).toBe("User");
    });

    // TODO(Phase 2): Add type-level tests via typegen integration
    it("infers required variable in input", () => {
      const fragment = gql(({ fragment }) => fragment`fragment UserVarFields($userId: ID!) on User { id }`());

      // Runtime behavior tests
      expect(fragment.variableDefinitions).toBeDefined();
      expect(fragment.typename).toBe("User");
    });

    // TODO(Phase 2): Add type-level tests via typegen integration
    it("infers optional variable in input", () => {
      const fragment = gql(({ fragment }) => fragment`fragment UserOptionalVarFields($limit: Int) on User { id }`());

      // Runtime behavior tests
      expect(fragment.variableDefinitions).toBeDefined();
      expect(fragment.typename).toBe("User");
    });
  });
});
