import { describe, expect, it } from "bun:test";
import { define, unsafeOutputType } from "../../test/utils/schema";
import { defineOperationRoots, defineScalar } from "../schema";
import type { AnyGraphqlSchema } from "../types/schema";
import { createFragmentTaggedTemplate } from "./fragment-tagged-template";

const schema = {
  label: "test" as const,
  operations: defineOperationRoots({
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
  }),
  scalar: {
    ...defineScalar<"ID", string, string>("ID"),
    ...defineScalar<"String", string, string>("String"),
    ...defineScalar<"Int", string, number>("Int"),
    ...defineScalar<"Boolean", string, boolean>("Boolean"),
  },
  enum: {},
  input: {},
  object: {
    Query: define("Query").object({}),
    Mutation: define("Mutation").object({}),
    Subscription: define("Subscription").object({}),
    User: define("User").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      name: unsafeOutputType.scalar("String:!", {}),
      email: unsafeOutputType.scalar("String:?", {}),
    }),
    Post: define("Post").object({
      id: unsafeOutputType.scalar("ID:!", {}),
      title: unsafeOutputType.scalar("String:!", {}),
    }),
  },
  union: {},
} satisfies AnyGraphqlSchema;

describe("createFragmentTaggedTemplate", () => {
  const fragment = createFragmentTaggedTemplate(schema);

  describe("basic fragment creation", () => {
    it("parses a valid fragment and produces a Fragment", () => {
      const result = fragment`fragment UserFields on User { id name }`();
      expect(result.typename).toBe("User");
      expect(result.key).toBe("UserFields");
      expect(result.schemaLabel).toBe("test");
    });

    it("fragment with on User type condition resolves correctly", () => {
      const result = fragment`fragment UserInfo on User { id name email }`();
      expect(result.typename).toBe("User");
    });

    it("fragment on Post type resolves correctly", () => {
      const result = fragment`fragment PostFields on Post { id title }`();
      expect(result.typename).toBe("Post");
      expect(result.key).toBe("PostFields");
    });
  });

  describe("variable definitions", () => {
    it("fragment without variables produces empty variableDefinitions", () => {
      const result = fragment`fragment UserFields on User { id name }`();
      expect(result.variableDefinitions).toEqual({});
    });

    it("fragment with variables extracts VarSpecifier records", () => {
      const result = fragment`fragment UserFields($showEmail: Boolean!) on User { id }`();
      expect(result.variableDefinitions).toHaveProperty("showEmail");
      const showEmail = (result.variableDefinitions as Record<string, any>).showEmail;
      expect(showEmail.kind).toBe("scalar");
      expect(showEmail.name).toBe("Boolean");
      expect(showEmail.modifier).toBe("!");
    });

    it("fragment with default values extracts defaultValue", () => {
      const result = fragment`fragment UserFields($limit: Int = 10) on User { id }`();
      const limit = (result.variableDefinitions as Record<string, any>).limit;
      expect(limit.kind).toBe("scalar");
      expect(limit.name).toBe("Int");
      expect(limit.defaultValue).toEqual({ default: 10 });
    });

    it("fragment with multiple variables extracts all", () => {
      const result = fragment`fragment UserFields($showEmail: Boolean!, $limit: Int) on User { id }`();
      const varDefs = result.variableDefinitions as Record<string, any>;
      expect(Object.keys(varDefs)).toHaveLength(2);
      expect(varDefs).toHaveProperty("showEmail");
      expect(varDefs).toHaveProperty("limit");
    });
  });

  describe("error handling", () => {
    it("throws when source contains interpolation", () => {
      const fn = createFragmentTaggedTemplate(schema);
      // biome-ignore lint/suspicious/noExplicitAny: Testing error case
      expect(() => (fn as any)(["part1", "part2"], "interpolated")).toThrow("interpolated expressions");
    });

    it("throws on parse errors", () => {
      expect(() => fragment`fragment UserFields on User { invalid!!! syntax }`).toThrow("GraphQL parse error");
    });

    it("throws when onType is not found in schema", () => {
      expect(() => fragment`fragment Foo on NonExistent { id }`).toThrow('Type "NonExistent" is not defined in schema objects');
    });

    it("throws when source contains no fragment definition", () => {
      expect(() => fragment`query GetUser { user { id } }`).toThrow("Expected a fragment definition, found none");
    });

    it("throws when source contains multiple fragment definitions", () => {
      expect(() => fragment`fragment A on User { id } fragment B on Post { id }`).toThrow(
        "Expected exactly one fragment definition, found 2",
      );
    });

    it("throws when selecting a field not in the schema", () => {
      const frag = fragment`fragment Foo on User { nonexistent }`();
      expect(() => frag.spread({} as never)).toThrow('Field "nonexistent" is not defined on type "User"');
    });
  });

  describe("spread function", () => {
    it("spread function is callable and returns", () => {
      const result = fragment`fragment UserFields on User { id name }`();
      expect(typeof result.spread).toBe("function");
      const spreadResult = result.spread({} as never);
      expect(spreadResult).toBeDefined();
    });

    it("allows __typename as an implicit introspection field", () => {
      const result = fragment`fragment UserWithTypename on User { __typename id name }`();
      const fields = result.spread({} as never);
      expect(fields).toHaveProperty("__typename");
    });
  });
});
