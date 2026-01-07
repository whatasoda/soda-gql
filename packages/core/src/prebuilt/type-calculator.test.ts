import { describe, expect, test } from "bun:test";
import { Kind, type TypeNode, type VariableDefinitionNode } from "graphql";
import type { AnyFieldSelection } from "../types/fragment";
import type { AnyGraphqlSchema } from "../types/schema";
import {
  applyTypeModifier,
  calculateFieldsType,
  calculateFieldType,
  generateInputObjectType,
  generateInputType,
  getScalarInputType,
  getScalarOutputType,
  getScalarType,
  graphqlTypeToTypeScript,
} from "./type-calculator";

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

describe("getScalarOutputType", () => {
  test("returns ScalarOutput reference for built-in scalars", () => {
    // All scalars in schema use ScalarOutput reference
    expect(getScalarOutputType(mockSchema, "String")).toBe('ScalarOutput<"String">');
    expect(getScalarOutputType(mockSchema, "Int")).toBe('ScalarOutput<"Int">');
    expect(getScalarOutputType(mockSchema, "Boolean")).toBe('ScalarOutput<"Boolean">');
    expect(getScalarOutputType(mockSchema, "ID")).toBe('ScalarOutput<"ID">');
  });

  test("returns ScalarOutput reference for custom scalar", () => {
    const schemaWithCustomScalar: AnyGraphqlSchema = {
      ...mockSchema,
      scalar: {
        ...mockSchema.scalar,
        DateTime: {
          name: "DateTime",
          $type: { input: "", output: new Date(), inputProfile: {} as never, outputProfile: {} as never },
        },
      },
    };
    expect(getScalarOutputType(schemaWithCustomScalar, "DateTime")).toBe('ScalarOutput<"DateTime">');
  });

  test("returns unknown for scalar not in schema", () => {
    expect(getScalarOutputType(mockSchema, "UnknownScalar")).toBe("unknown");
  });
});

describe("getScalarInputType", () => {
  test("returns ScalarInput reference for built-in scalars", () => {
    expect(getScalarInputType(mockSchema, "String")).toBe('ScalarInput<"String">');
    expect(getScalarInputType(mockSchema, "Int")).toBe('ScalarInput<"Int">');
    expect(getScalarInputType(mockSchema, "Boolean")).toBe('ScalarInput<"Boolean">');
    expect(getScalarInputType(mockSchema, "ID")).toBe('ScalarInput<"ID">');
  });

  test("returns unknown for scalar not in schema", () => {
    expect(getScalarInputType(mockSchema, "UnknownScalar")).toBe("unknown");
  });
});

describe("getScalarType (deprecated alias)", () => {
  test("is an alias for getScalarOutputType", () => {
    expect(getScalarType(mockSchema, "String")).toBe(getScalarOutputType(mockSchema, "String"));
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

    expect(calculateFieldType(mockSchema, selection)).toBe('ScalarOutput<"String">');
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

    expect(calculateFieldType(mockSchema, selection)).toBe('(ScalarOutput<"String"> | null | undefined)');
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

    expect(calculateFieldType(mockSchema, selection)).toBe(
      '{ readonly id: ScalarOutput<"ID">; readonly name: ScalarOutput<"String"> }',
    );
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

    expect(calculateFieldType(mockSchema, selection)).toBe('({ readonly id: ScalarOutput<"ID"> })[]');
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
      '{ readonly id: ScalarOutput<"ID">; readonly name: (ScalarOutput<"String"> | null | undefined) }',
    );
  });
});

describe("graphqlTypeToTypeScript", () => {
  test("handles NamedType for scalar (uses ScalarInput)", () => {
    const typeNode: TypeNode = {
      kind: Kind.NAMED_TYPE,
      name: { kind: Kind.NAME, value: "String" },
    };
    // graphqlTypeToTypeScript is used for input types, so it uses ScalarInput
    expect(graphqlTypeToTypeScript(mockSchema, typeNode)).toBe('ScalarInput<"String">');
  });

  test("handles NamedType for enum", () => {
    const typeNode: TypeNode = {
      kind: Kind.NAMED_TYPE,
      name: { kind: Kind.NAME, value: "Status" },
    };
    expect(graphqlTypeToTypeScript(mockSchema, typeNode)).toBe('"ACTIVE" | "INACTIVE" | "PENDING"');
  });

  test("handles NamedType for input object (uses name directly)", () => {
    const typeNode: TypeNode = {
      kind: Kind.NAMED_TYPE,
      name: { kind: Kind.NAME, value: "UserInput" },
    };
    expect(graphqlTypeToTypeScript(mockSchema, typeNode)).toBe("UserInput");
  });

  test("handles NonNullType", () => {
    const typeNode: TypeNode = {
      kind: Kind.NON_NULL_TYPE,
      type: {
        kind: Kind.NAMED_TYPE,
        name: { kind: Kind.NAME, value: "ID" },
      },
    };
    expect(graphqlTypeToTypeScript(mockSchema, typeNode)).toBe('ScalarInput<"ID">');
  });

  test("handles ListType", () => {
    const typeNode: TypeNode = {
      kind: Kind.LIST_TYPE,
      type: {
        kind: Kind.NAMED_TYPE,
        name: { kind: Kind.NAME, value: "String" },
      },
    };
    expect(graphqlTypeToTypeScript(mockSchema, typeNode)).toBe('(ScalarInput<"String">)[]');
  });

  test("handles nested NonNullType with ListType", () => {
    const typeNode: TypeNode = {
      kind: Kind.NON_NULL_TYPE,
      type: {
        kind: Kind.LIST_TYPE,
        type: {
          kind: Kind.NON_NULL_TYPE,
          type: {
            kind: Kind.NAMED_TYPE,
            name: { kind: Kind.NAME, value: "Int" },
          },
        },
      },
    };
    expect(graphqlTypeToTypeScript(mockSchema, typeNode)).toBe('(ScalarInput<"Int">)[]');
  });
});

describe("generateInputType", () => {
  test("handles empty variable definitions", () => {
    expect(generateInputType(mockSchema, [])).toBe("{}");
  });

  test("handles single required variable", () => {
    const variableDefinitions: VariableDefinitionNode[] = [
      {
        kind: Kind.VARIABLE_DEFINITION,
        variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "userId" } },
        type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "ID" } } },
      },
    ];
    expect(generateInputType(mockSchema, variableDefinitions)).toBe('{ readonly userId: ScalarInput<"ID"> }');
  });

  test("handles single optional variable", () => {
    const variableDefinitions: VariableDefinitionNode[] = [
      {
        kind: Kind.VARIABLE_DEFINITION,
        variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "filter" } },
        type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "String" } },
      },
    ];
    expect(generateInputType(mockSchema, variableDefinitions)).toBe(
      '{ readonly filter?: (ScalarInput<"String"> | null | undefined) }',
    );
  });

  test("handles multiple variables", () => {
    const variableDefinitions: VariableDefinitionNode[] = [
      {
        kind: Kind.VARIABLE_DEFINITION,
        variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "id" } },
        type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "ID" } } },
      },
      {
        kind: Kind.VARIABLE_DEFINITION,
        variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "status" } },
        type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "Status" } },
      },
    ];
    expect(generateInputType(mockSchema, variableDefinitions)).toBe(
      '{ readonly id: ScalarInput<"ID">; readonly status?: ("ACTIVE" | "INACTIVE" | "PENDING" | null | undefined) }',
    );
  });

  test("handles array variable", () => {
    const variableDefinitions: VariableDefinitionNode[] = [
      {
        kind: Kind.VARIABLE_DEFINITION,
        variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "ids" } },
        type: {
          kind: Kind.NON_NULL_TYPE,
          type: {
            kind: Kind.LIST_TYPE,
            type: { kind: Kind.NON_NULL_TYPE, type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "ID" } } },
          },
        },
      },
    ];
    expect(generateInputType(mockSchema, variableDefinitions)).toBe('{ readonly ids: (ScalarInput<"ID">)[] }');
  });

  test("handles input object variable", () => {
    const variableDefinitions: VariableDefinitionNode[] = [
      {
        kind: Kind.VARIABLE_DEFINITION,
        variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: "input" } },
        type: {
          kind: Kind.NON_NULL_TYPE,
          type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: "CreateUserInput" } },
        },
      },
    ];
    expect(generateInputType(mockSchema, variableDefinitions)).toBe("{ readonly input: CreateUserInput }");
  });
});

// Mock schema with input objects for generateInputObjectType tests
const schemaWithInputs: AnyGraphqlSchema = {
  ...mockSchema,
  input: {
    CreateUserInput: {
      name: "CreateUserInput",
      fields: {
        name: { kind: "scalar", name: "String", modifier: "!", defaultValue: null },
        email: { kind: "scalar", name: "String", modifier: "?", defaultValue: null },
        age: { kind: "scalar", name: "Int", modifier: "?", defaultValue: null },
      },
    },
    UpdateUserInput: {
      name: "UpdateUserInput",
      fields: {
        id: { kind: "scalar", name: "ID", modifier: "!", defaultValue: null },
        data: { kind: "input", name: "CreateUserInput", modifier: "!", defaultValue: null },
      },
    },
    FilterInput: {
      name: "FilterInput",
      fields: {
        status: { kind: "enum", name: "Status", modifier: "?", defaultValue: null },
        ids: { kind: "scalar", name: "ID", modifier: "![]!", defaultValue: null },
      },
    },
    RecursiveInput: {
      name: "RecursiveInput",
      fields: {
        value: { kind: "scalar", name: "String", modifier: "!", defaultValue: null },
        children: { kind: "input", name: "RecursiveInput", modifier: "?[]?", defaultValue: null },
      },
    },
  },
};

describe("generateInputObjectType", () => {
  test("generates simple input object type", () => {
    const result = generateInputObjectType(schemaWithInputs, "CreateUserInput");
    expect(result).toBe(
      '{ readonly name: ScalarInput<"String">; readonly email?: (ScalarInput<"String"> | null | undefined); readonly age?: (ScalarInput<"Int"> | null | undefined) }',
    );
  });

  test("generates nested input object type", () => {
    const result = generateInputObjectType(schemaWithInputs, "UpdateUserInput");
    expect(result).toContain('readonly id: ScalarInput<"ID">');
    expect(result).toContain("readonly data:");
    // The nested CreateUserInput should be expanded
    expect(result).toContain('readonly name: ScalarInput<"String">');
  });

  test("handles enum fields", () => {
    const result = generateInputObjectType(schemaWithInputs, "FilterInput");
    expect(result).toContain('"ACTIVE" | "INACTIVE" | "PENDING"');
  });

  test("handles array fields", () => {
    const result = generateInputObjectType(schemaWithInputs, "FilterInput");
    expect(result).toContain('(ScalarInput<"ID">)[]');
  });

  test("returns unknown for non-existent input", () => {
    const result = generateInputObjectType(schemaWithInputs, "NonExistentInput");
    expect(result).toBe("unknown");
  });

  test("handles circular references", () => {
    const result = generateInputObjectType(schemaWithInputs, "RecursiveInput");
    // Should not infinite loop, should return unknown for circular reference
    expect(result).toContain('readonly value: ScalarInput<"String">');
    expect(result).toContain("readonly children?:");
  });

  test("respects depth limit", () => {
    const result = generateInputObjectType(schemaWithInputs, "RecursiveInput", { defaultDepth: 1 });
    // At depth 1, nested RecursiveInput should become unknown
    expect(result).toContain("unknown");
  });

  test("respects depth overrides", () => {
    const result = generateInputObjectType(schemaWithInputs, "RecursiveInput", {
      defaultDepth: 1,
      depthOverrides: { RecursiveInput: 3 },
    });
    // With depth override, should expand more levels
    expect(result).not.toBe("unknown");
    expect(result).toContain('readonly value: ScalarInput<"String">');
  });

  test("handles empty input object", () => {
    const schemaWithEmptyInput: AnyGraphqlSchema = {
      ...mockSchema,
      input: {
        EmptyInput: {
          name: "EmptyInput",
          fields: {},
        },
      },
    };
    const result = generateInputObjectType(schemaWithEmptyInput, "EmptyInput");
    expect(result).toBe("{}");
  });

  test("handles fields with default values as optional", () => {
    const schemaWithDefaults: AnyGraphqlSchema = {
      ...mockSchema,
      input: {
        InputWithDefaults: {
          name: "InputWithDefaults",
          fields: {
            requiredField: { kind: "scalar", name: "String", modifier: "!", defaultValue: null },
            fieldWithDefault: { kind: "scalar", name: "Int", modifier: "!", defaultValue: { default: 42 } },
          },
        },
      },
    };
    const result = generateInputObjectType(schemaWithDefaults, "InputWithDefaults");
    // Field with default should be optional (have ?)
    expect(result).toContain("readonly requiredField: ScalarInput");
    expect(result).toContain("readonly fieldWithDefault?: ScalarInput");
  });
});
