import { describe, expect, it } from "bun:test";
import type { StandardDirectives } from "../../src/composer/directive-builder";
import { createGqlElementComposer } from "../../src/composer/gql-composer";
import type { BasicTestSchema } from "../fixtures";
import { basicInputTypeMethods, basicTestSchema } from "../fixtures";

const gql = createGqlElementComposer<BasicTestSchema, StandardDirectives>(
  basicTestSchema, { inputTypeMethods: basicInputTypeMethods }
);

describe("tagged template fragment integration", () => {
  describe("basic fragment", () => {
    it("creates fragment from tagged template", () => {
      const UserFields = gql(({ fragment }) =>
        fragment`fragment UserFields on User { id name }`(),
      );
      expect(UserFields.key).toBe("UserFields");
      expect(UserFields.typename).toBe("User");
      expect(UserFields.schemaLabel).toBe(basicTestSchema.label);
    });

    it("spread returns field selections", () => {
      const UserFields = gql(({ fragment }) =>
        fragment`fragment UserFields on User { id name }`(),
      );
      const fields = UserFields.spread();
      expect(fields).toBeDefined();
      expect(typeof fields).toBe("object");
    });
  });

  describe("fragment is callable tagged template", () => {
    it("fragment is a function", () => {
      gql(({ fragment }) => {
        expect(typeof fragment).toBe("function");
        return fragment`fragment TestFrag on User { id }`();
      });
    });
  });
});
