import { describe, expect, it } from "bun:test";
import { parse as parseGql, type VariableDefinitionNode } from "graphql";
import { createSchemaIndex } from "./schema-index";
import { buildVarSpecifier, buildVarSpecifiers } from "./var-specifier-builder";

const schema = createSchemaIndex(
  parseGql(`
    scalar CustomScalar
    enum Status { ACTIVE INACTIVE }
    input UserFilter { name: String, status: Status }
    type Query { dummy: String }
  `),
);

const getVarDefs = (source: string): readonly VariableDefinitionNode[] => {
  const doc = parseGql(source);
  const op = doc.definitions[0];
  if (!op || op.kind !== "OperationDefinition") throw new Error("Expected operation");
  return op.variableDefinitions ?? [];
};

describe("buildVarSpecifier", () => {
  describe("type resolution", () => {
    it("resolves builtin scalar ID", () => {
      const [node] = getVarDefs("query Q($id: ID!) { __typename }");
      const result = buildVarSpecifier(node!, schema);
      expect(result.kind).toBe("scalar");
      expect(result.name).toBe("ID");
    });

    it("resolves builtin scalar String", () => {
      const [node] = getVarDefs("query Q($name: String) { __typename }");
      const result = buildVarSpecifier(node!, schema);
      expect(result.kind).toBe("scalar");
      expect(result.name).toBe("String");
    });

    it("resolves builtin scalar Int", () => {
      const [node] = getVarDefs("query Q($count: Int) { __typename }");
      const result = buildVarSpecifier(node!, schema);
      expect(result.kind).toBe("scalar");
      expect(result.name).toBe("Int");
    });

    it("resolves builtin scalar Float", () => {
      const [node] = getVarDefs("query Q($price: Float) { __typename }");
      const result = buildVarSpecifier(node!, schema);
      expect(result.kind).toBe("scalar");
      expect(result.name).toBe("Float");
    });

    it("resolves builtin scalar Boolean", () => {
      const [node] = getVarDefs("query Q($active: Boolean) { __typename }");
      const result = buildVarSpecifier(node!, schema);
      expect(result.kind).toBe("scalar");
      expect(result.name).toBe("Boolean");
    });

    it("resolves custom scalar", () => {
      const [node] = getVarDefs("query Q($val: CustomScalar!) { __typename }");
      const result = buildVarSpecifier(node!, schema);
      expect(result.kind).toBe("scalar");
      expect(result.name).toBe("CustomScalar");
    });

    it("resolves enum type", () => {
      const [node] = getVarDefs("query Q($status: Status!) { __typename }");
      const result = buildVarSpecifier(node!, schema);
      expect(result.kind).toBe("enum");
      expect(result.name).toBe("Status");
    });

    it("resolves input type", () => {
      const [node] = getVarDefs("query Q($filter: UserFilter) { __typename }");
      const result = buildVarSpecifier(node!, schema);
      expect(result.kind).toBe("input");
      expect(result.name).toBe("UserFilter");
    });

    it("throws on unknown type name", () => {
      const [node] = getVarDefs("query Q($x: UnknownType!) { __typename }");
      expect(() => buildVarSpecifier(node!, schema)).toThrow(
        'Cannot resolve type kind for "UnknownType": not found in schema as scalar, enum, or input',
      );
    });
  });

  describe("modifier parsing", () => {
    it("parses non-null modifier", () => {
      const [node] = getVarDefs("query Q($id: ID!) { __typename }");
      expect(buildVarSpecifier(node!, schema).modifier).toBe("!");
    });

    it("parses nullable modifier", () => {
      const [node] = getVarDefs("query Q($id: ID) { __typename }");
      expect(buildVarSpecifier(node!, schema).modifier).toBe("?");
    });

    it("parses non-null list of non-null", () => {
      const [node] = getVarDefs("query Q($ids: [ID!]!) { __typename }");
      expect(buildVarSpecifier(node!, schema).modifier).toBe("![]!");
    });

    it("parses nullable list of nullable", () => {
      const [node] = getVarDefs("query Q($ids: [ID]) { __typename }");
      expect(buildVarSpecifier(node!, schema).modifier).toBe("?[]?");
    });
  });

  describe("default value extraction", () => {
    it("returns null when no default value", () => {
      const [node] = getVarDefs("query Q($id: ID!) { __typename }");
      expect(buildVarSpecifier(node!, schema).defaultValue).toBeNull();
    });

    it("extracts int default value", () => {
      const [node] = getVarDefs("query Q($limit: Int = 10) { __typename }");
      expect(buildVarSpecifier(node!, schema).defaultValue).toEqual({ default: 10 });
    });

    it("extracts float default value", () => {
      const [node] = getVarDefs("query Q($price: Float = 9.99) { __typename }");
      expect(buildVarSpecifier(node!, schema).defaultValue).toEqual({ default: 9.99 });
    });

    it("extracts string default value", () => {
      const [node] = getVarDefs('query Q($name: String = "hello") { __typename }');
      expect(buildVarSpecifier(node!, schema).defaultValue).toEqual({ default: "hello" });
    });

    it("extracts boolean default value", () => {
      const [node] = getVarDefs("query Q($active: Boolean = true) { __typename }");
      expect(buildVarSpecifier(node!, schema).defaultValue).toEqual({ default: true });
    });

    it("extracts null default value", () => {
      const [node] = getVarDefs("query Q($name: String = null) { __typename }");
      expect(buildVarSpecifier(node!, schema).defaultValue).toEqual({ default: null });
    });

    it("extracts enum default value", () => {
      const [node] = getVarDefs("query Q($status: Status = ACTIVE) { __typename }");
      expect(buildVarSpecifier(node!, schema).defaultValue).toEqual({ default: "ACTIVE" });
    });

    it("extracts list default value", () => {
      const [node] = getVarDefs('query Q($ids: [ID!]! = ["a", "b"]) { __typename }');
      expect(buildVarSpecifier(node!, schema).defaultValue).toEqual({ default: ["a", "b"] });
    });

    it("extracts object default value", () => {
      const [node] = getVarDefs('query Q($filter: UserFilter = { name: "test" }) { __typename }');
      expect(buildVarSpecifier(node!, schema).defaultValue).toEqual({ default: { name: "test" } });
    });
  });

  it("has empty directives", () => {
    const [node] = getVarDefs("query Q($id: ID!) { __typename }");
    expect(buildVarSpecifier(node!, schema).directives).toEqual({});
  });
});

describe("buildVarSpecifiers", () => {
  it("produces correct record keyed by variable name", () => {
    const nodes = getVarDefs("query Q($id: ID!, $status: Status, $limit: Int = 10) { __typename }");
    const result = buildVarSpecifiers(nodes, schema);

    expect(Object.keys(result).sort()).toEqual(["id", "limit", "status"]);
    expect(result.id).toMatchObject({ kind: "scalar", name: "ID", modifier: "!" });
    expect(result.status).toMatchObject({ kind: "enum", name: "Status", modifier: "?" });
    expect(result.limit).toMatchObject({ kind: "scalar", name: "Int", modifier: "?" });
    expect(result.limit!.defaultValue).toEqual({ default: 10 });
  });

  it("returns empty record for no variables", () => {
    const nodes = getVarDefs("query Q { __typename }");
    const result = buildVarSpecifiers(nodes, schema);
    expect(result).toEqual({});
  });
});
