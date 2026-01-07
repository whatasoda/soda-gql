import { describe, expect, test } from "bun:test";
import { applyTypeModifier, calculateFieldType, calculateFieldsType } from "./type-calculator";
import type { AnyFieldSelection } from "../types/fragment";
import type { AnyGraphqlSchema } from "../types/schema";

// Mock schema for testing
const mockSchema: AnyGraphqlSchema = {
  label: "test",
  operations: {
    query: "Query",
    mutation: "Mutation",
    subscription: null,
  },
  scalar: {
    ID: { name: "ID", $type: { input: "", output: "", inputProfile: {} as never, outputProfile: {} as never } },
    String: { name: "String", $type: { input: "", output: "", inputProfile: {} as never, outputProfile: {} as never } },
    Int: { name: "Int", $type: { input: 0, output: 0, inputProfile: {} as never, outputProfile: {} as never } },
    Boolean: {
      name: "Boolean",
      $type: { input: false, output: false, inputProfile: {} as never, outputProfile: {} as never },
    },
  },
  enum: {
    Status: {
      name: "Status",
      values: { ACTIVE: true, INACTIVE: true, PENDING: true },
      $type: { name: "Status", inputProfile: {} as never, outputProfile: {} as never },
    },
  },
  input: {},
  object: {
    Query: { name: "Query", fields: {} },
    Mutation: { name: "Mutation", fields: {} },
    User: { name: "User", fields: {} },
  },
  union: {},
};

describe("applyTypeModifier", () => {
  test("handles required modifier (!)", () => {
    expect(applyTypeModifier("string", "!")).toBe("string");
  });

  test("handles optional modifier (?)", () => {
    expect(applyTypeModifier("string", "?")).toBe("(string | null | undefined)");
  });

  test("handles required array of required items (![]!)", () => {
    expect(applyTypeModifier("string", "![]!")).toBe("(string)[]");
  });

  test("handles optional array of required items (![]?)", () => {
    expect(applyTypeModifier("string", "![]?")).toBe("((string)[] | null | undefined)");
  });

  test("handles required array of optional items (?[]!)", () => {
    expect(applyTypeModifier("string", "?[]!")).toBe("((string | null | undefined))[]");
  });

  test("handles optional array of optional items (?[]?)", () => {
    expect(applyTypeModifier("string", "?[]?")).toBe("(((string | null | undefined))[] | null | undefined)");
  });

  test("handles nested arrays (![]![]!)", () => {
    expect(applyTypeModifier("string", "![]![]!")).toBe("((string)[])[]");
  });
});

describe("calculateFieldType", () => {
  test("handles scalar field", () => {
    const selection: AnyFieldSelection = {
      parent: "User",
      field: "name",
      type: { kind: "scalar", name: "String", modifier: "!", arguments: {} },
      args: {},
      directives: [],
      object: null,
      union: null,
    };

    expect(calculateFieldType(mockSchema, selection)).toBe("string");
  });

  test("handles nullable scalar field", () => {
    const selection: AnyFieldSelection = {
      parent: "User",
      field: "email",
      type: { kind: "scalar", name: "String", modifier: "?", arguments: {} },
      args: {},
      directives: [],
      object: null,
      union: null,
    };

    expect(calculateFieldType(mockSchema, selection)).toBe("(string | null | undefined)");
  });

  test("handles enum field", () => {
    const selection: AnyFieldSelection = {
      parent: "User",
      field: "status",
      type: { kind: "enum", name: "Status", modifier: "!", arguments: {} },
      args: {},
      directives: [],
      object: null,
      union: null,
    };

    expect(calculateFieldType(mockSchema, selection)).toBe('"ACTIVE" | "INACTIVE" | "PENDING"');
  });

  test("handles __typename field", () => {
    const selection: AnyFieldSelection = {
      parent: "User",
      field: "__typename",
      type: { kind: "typename", name: "User", modifier: "!", arguments: {} },
      args: {},
      directives: [],
      object: null,
      union: null,
    };

    expect(calculateFieldType(mockSchema, selection)).toBe('"User"');
  });

  test("handles object field with nested selection", () => {
    const selection: AnyFieldSelection = {
      parent: "Query",
      field: "user",
      type: { kind: "object", name: "User", modifier: "!", arguments: {} },
      args: {},
      directives: [],
      object: {
        id: {
          parent: "User",
          field: "id",
          type: { kind: "scalar", name: "ID", modifier: "!", arguments: {} },
          args: {},
          directives: [],
          object: null,
          union: null,
        },
        name: {
          parent: "User",
          field: "name",
          type: { kind: "scalar", name: "String", modifier: "!", arguments: {} },
          args: {},
          directives: [],
          object: null,
          union: null,
        },
      },
      union: null,
    };

    expect(calculateFieldType(mockSchema, selection)).toBe("{ readonly id: string; readonly name: string }");
  });

  test("handles array of objects", () => {
    const selection: AnyFieldSelection = {
      parent: "Query",
      field: "users",
      type: { kind: "object", name: "User", modifier: "![]!", arguments: {} },
      args: {},
      directives: [],
      object: {
        id: {
          parent: "User",
          field: "id",
          type: { kind: "scalar", name: "ID", modifier: "!", arguments: {} },
          args: {},
          directives: [],
          object: null,
          union: null,
        },
      },
      union: null,
    };

    expect(calculateFieldType(mockSchema, selection)).toBe("({ readonly id: string })[]");
  });
});

describe("calculateFieldsType", () => {
  test("handles empty fields", () => {
    expect(calculateFieldsType(mockSchema, {})).toBe("{}");
  });

  test("handles multiple fields", () => {
    const fields = {
      id: {
        parent: "User",
        field: "id",
        type: { kind: "scalar", name: "ID", modifier: "!", arguments: {} },
        args: {},
        directives: [],
        object: null,
        union: null,
      } as AnyFieldSelection,
      name: {
        parent: "User",
        field: "name",
        type: { kind: "scalar", name: "String", modifier: "?", arguments: {} },
        args: {},
        directives: [],
        object: null,
        union: null,
      } as AnyFieldSelection,
    };

    expect(calculateFieldsType(mockSchema, fields)).toBe(
      "{ readonly id: string; readonly name: (string | null | undefined) }",
    );
  });
});
