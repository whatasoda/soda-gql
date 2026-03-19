import { describe, expect, it } from "bun:test";
import { parseSync } from "@swc/core";
import type { Module, Node } from "@swc/types";
import { createSwcSpanConverter } from "../utils/swc-span";
import { extractFieldCallTree, isOperationKind, OPERATION_KINDS, type PositionTrackingContext, walkAndExtract } from "./extract";

const parseSource = (source: string): Module => {
  const result = parseSync(source, {
    syntax: "typescript",
    tsx: false,
    decorators: false,
    dynamicImport: true,
  });
  if (result.type !== "Module") throw new Error("Not a module");
  return result;
};

/** Collect gql identifiers from a module (simple import-name-based detection for tests). */
const collectTestIdentifiers = (module: Module): ReadonlySet<string> => {
  const identifiers = new Set<string>();
  for (const item of module.body) {
    if (item.type !== "ImportDeclaration") continue;
    for (const specifier of item.specifiers) {
      if (specifier.type === "ImportSpecifier") {
        const imported = specifier.imported?.value ?? specifier.local.value;
        if (imported === "gql") {
          identifiers.add(specifier.local.value);
        }
      }
    }
  }
  return identifiers;
};

describe("OPERATION_KINDS", () => {
  it("contains all four operation kinds", () => {
    expect(OPERATION_KINDS.has("query")).toBe(true);
    expect(OPERATION_KINDS.has("mutation")).toBe(true);
    expect(OPERATION_KINDS.has("subscription")).toBe(true);
    expect(OPERATION_KINDS.has("fragment")).toBe(true);
  });
});

describe("isOperationKind", () => {
  it("returns true for valid kinds", () => {
    expect(isOperationKind("query")).toBe(true);
    expect(isOperationKind("fragment")).toBe(true);
  });

  it("returns false for invalid kinds", () => {
    expect(isOperationKind("invalid")).toBe(false);
    expect(isOperationKind("")).toBe(false);
  });
});

describe("walkAndExtract", () => {
  it("extracts bare-tag query template", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser($id: ID!) { user(id: $id) { id name } }\`
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.schemaName).toBe("default");
    expect(templates[0]!.kind).toBe("query");
    expect(templates[0]!.content).toContain("query GetUser");
    expect(templates[0]!.elementName).toBeUndefined();
    expect(templates[0]!.contentRange).toBeUndefined();
  });

  it("extracts curried query template", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query("GetUser")\`($id: ID!) { user(id: $id) { id name } }\`
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.kind).toBe("query");
    expect(templates[0]!.elementName).toBe("GetUser");
    expect(templates[0]!.content).toContain("user(id: $id)");
  });

  it("extracts curried fragment with typeName", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const UserFields = gql.default(({ fragment }) =>
        fragment("UserFields", "User")\`{ id name email }\`()
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.kind).toBe("fragment");
    expect(templates[0]!.elementName).toBe("UserFields");
    expect(templates[0]!.typeName).toBe("User");
    expect(templates[0]!.typeNameSpan).toBeUndefined();
  });

  it("extracts multiple templates from multi-schema source", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const A = gql.default(({ query }) => query\`query A { a { id } }\`);
      export const B = gql.admin(({ query }) => query\`query B { b { id } }\`);
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(2);
    expect(templates[0]!.schemaName).toBe("default");
    expect(templates[1]!.schemaName).toBe("admin");
  });

  it("handles metadata chaining", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query("GetUser")\`{ user { id } }\`({ metadata: { cache: 60 } })
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.elementName).toBe("GetUser");
  });

  it("handles block body with return statement", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) => {
        return query\`query GetUser { user { id } }\`;
      });
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
  });

  it("replaces interpolations with __FRAG_SPREAD_N__ placeholders", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query("GetUser")\`{ user { ...\${userFields} } }\`
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.content).toContain("__FRAG_SPREAD_0__");
  });

  it("skips bare-tag templates with interpolations", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser { \${someField} }\`
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(0);
  });

  it("extracts from method-chained gql calls", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query\`query GetUser { user { id } }\`
      ).attach("module", "/src/a.ts");
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
  });

  it("returns empty when no gql identifiers", () => {
    const source = `
      import { something } from "./other";
      export const foo = something();
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(0);
  });
});

describe("walkAndExtract with position tracking", () => {
  it("populates contentRange when positionCtx is provided", () => {
    const source = `import { gql } from "./graphql-system";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id } }\`
);`;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const converter = createSwcSpanConverter(source);
    const spanOffset = module.span.start;
    const positionCtx: PositionTrackingContext = { spanOffset, converter };

    const templates = walkAndExtract(module as unknown as Node, identifiers, positionCtx);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.contentRange).toBeDefined();

    const range = templates[0]!.contentRange!;
    const extracted = source.slice(range.start, range.end);
    expect(extracted).toBe("{ user { id } }");
  });

  it("populates typeNameSpan for curried fragment when positionCtx is provided", () => {
    const source = `import { gql } from "./graphql-system";
export const UserFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")\`{ id name }\`()
);`;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const converter = createSwcSpanConverter(source);
    const spanOffset = module.span.start;
    const positionCtx: PositionTrackingContext = { spanOffset, converter };

    const templates = walkAndExtract(module as unknown as Node, identifiers, positionCtx);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.typeName).toBe("User");
    expect(templates[0]!.typeNameSpan).toBeDefined();

    const span = templates[0]!.typeNameSpan!;
    expect(source.slice(span.start, span.end)).toBe("User");
  });

  it("does not populate typeNameSpan for query templates", () => {
    const source = `import { gql } from "./graphql-system";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id } }\`
);`;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const converter = createSwcSpanConverter(source);
    const spanOffset = module.span.start;
    const positionCtx: PositionTrackingContext = { spanOffset, converter };

    const templates = walkAndExtract(module as unknown as Node, identifiers, positionCtx);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.typeNameSpan).toBeUndefined();
  });

  it("does not populate contentRange when positionCtx is omitted", () => {
    const source = `import { gql } from "./graphql-system";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id } }\`
);`;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.contentRange).toBeUndefined();
  });

  it("tracks position correctly with interpolations", () => {
    const source = `import { gql } from "./graphql-system";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { ...\${fields} name } }\`
);`;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const converter = createSwcSpanConverter(source);
    const spanOffset = module.span.start;
    const positionCtx: PositionTrackingContext = { spanOffset, converter };

    const templates = walkAndExtract(module as unknown as Node, identifiers, positionCtx);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.contentRange).toBeDefined();
    // Content includes placeholder, so slice from source won't match content exactly
    // but the range should cover the full template area
    const range = templates[0]!.contentRange!;
    expect(range.start).toBeGreaterThan(0);
    expect(range.end).toBeGreaterThan(range.start);
  });
});

describe("callback builder variables extraction", () => {
  it("extracts variables from callback builder with trailing ({})", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query("GetUser")({ variables: \`($id: ID!)\`, fields: ({ f, $ }) => ({ ...f("user", { id: $.id })(({ f }) => ({ ...f("id")() })) }) })({})
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.source).toBe("callback-variables");
    expect(templates[0]!.kind).toBe("query");
    expect(templates[0]!.elementName).toBe("GetUser");
    expect(templates[0]!.content).toBe("($id: ID!)");
  });

  it("extracts variables from callback builder with metadata", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query("GetUser")({ variables: \`($id: ID!)\`, fields: ({ f }) => ({}) })({ metadata: { tag: "test" } })
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.source).toBe("callback-variables");
    expect(templates[0]!.elementName).toBe("GetUser");
    expect(templates[0]!.content).toBe("($id: ID!)");
  });

  it("extracts variables from callback builder without trailing call", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query("GetUser")({ variables: \`($id: ID!)\`, fields: ({ f }) => ({}) })
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.source).toBe("callback-variables");
    expect(templates[0]!.content).toBe("($id: ID!)");
  });

  it("extracts variables from mutation callback builder", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const CreateUser = gql.default(({ mutation }) =>
        mutation("CreateUser")({ variables: \`($input: CreateUserInput!)\`, fields: ({ f }) => ({}) })({})
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.source).toBe("callback-variables");
    expect(templates[0]!.kind).toBe("mutation");
    expect(templates[0]!.elementName).toBe("CreateUser");
    expect(templates[0]!.content).toBe("($input: CreateUserInput!)");
  });

  it("extracts variables from StringLiteral", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query("GetUser")({ variables: "($id: ID!)", fields: ({ f }) => ({}) })({})
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.source).toBe("callback-variables");
    expect(templates[0]!.content).toBe("($id: ID!)");
  });

  it("does not extract callback-variables when no variables property", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query("GetUser")({ fields: ({ f }) => ({}) })({})
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    // No callback-variables template extracted (fields-only callback builder has no GraphQL to extract)
    const callbackVarTemplates = templates.filter((t) => t.source === "callback-variables");
    expect(callbackVarTemplates).toHaveLength(0);
  });

  it("extracts both tagged template and callback-variables from same file", () => {
    const source = `
      import { gql } from "./graphql-system";
      export const GetUser = gql.default(({ query }) =>
        query("GetUser")\`{ user { id } }\`
      );
      export const CreateUser = gql.default(({ mutation }) =>
        mutation("CreateUser")({ variables: \`($input: CreateUserInput!)\`, fields: ({ f }) => ({}) })({})
      );
    `;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const templates = walkAndExtract(module as unknown as Node, identifiers);

    expect(templates).toHaveLength(2);
    expect(templates[0]!.source).toBeUndefined(); // tagged template
    expect(templates[1]!.source).toBe("callback-variables");
  });
});

describe("callback builder variables with position tracking", () => {
  it("tracks contentRange for TemplateLiteral variables", () => {
    const source = `import { gql } from "./graphql-system";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")({ variables: \`($id: ID!)\`, fields: ({ f }) => ({}) })({})
);`;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const converter = createSwcSpanConverter(source);
    const spanOffset = module.span.start;
    const positionCtx: PositionTrackingContext = { spanOffset, converter };

    const templates = walkAndExtract(module as unknown as Node, identifiers, positionCtx);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.contentRange).toBeDefined();

    const range = templates[0]!.contentRange!;
    const extracted = source.slice(range.start, range.end);
    expect(extracted).toBe("($id: ID!)");
  });

  it("tracks contentRange for StringLiteral variables", () => {
    const source = `import { gql } from "./graphql-system";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")({ variables: "($id: ID!)", fields: ({ f }) => ({}) })({})
);`;

    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);
    const converter = createSwcSpanConverter(source);
    const spanOffset = module.span.start;
    const positionCtx: PositionTrackingContext = { spanOffset, converter };

    const templates = walkAndExtract(module as unknown as Node, identifiers, positionCtx);

    expect(templates).toHaveLength(1);
    expect(templates[0]!.contentRange).toBeDefined();

    const range = templates[0]!.contentRange!;
    const extracted = source.slice(range.start, range.end);
    expect(extracted).toBe("($id: ID!)");
  });
});

describe("extractFieldCallTree", () => {
  it("extracts scalar fields", () => {
    const source = `
import { gql } from "@soda-gql/test";
export const q = gql.default(({ query }) =>
  query("GetUser")({
    fields: ({ f }) => ({
      ...f("id")(),
      ...f("name")(),
    }),
  })({}),
);
`;
    const module = parseSource(source);
    const tree = findAndExtractFieldTree(module as unknown as Node, "default");
    expect(tree).not.toBeNull();
    expect(tree!.schemaName).toBe("default");
    expect(tree!.kind).toBe("query");
    expect(tree!.elementName).toBe("GetUser");
    expect(tree!.children).toHaveLength(2);
    expect(tree!.children[0]!.fieldName).toBe("id");
    expect(tree!.children[0]!.nested).toBeNull();
    expect(tree!.children[1]!.fieldName).toBe("name");
    expect(tree!.children[1]!.nested).toBeNull();
  });

  it("extracts nested object fields", () => {
    const source = `
import { gql } from "@soda-gql/test";
export const q = gql.default(({ query }) =>
  query("GetUser")({
    fields: ({ f }) => ({
      ...f("user")(({ f }) => ({
        ...f("id")(),
        ...f("name")(),
      })),
    }),
  })({}),
);
`;
    const module = parseSource(source);
    const tree = findAndExtractFieldTree(module as unknown as Node, "default");
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(1);
    const userField = tree!.children[0]!;
    expect(userField.fieldName).toBe("user");
    expect(userField.nested).not.toBeNull();
    const userNested = userField.nested!;
    expect(userNested.kind).toBe("object");
    if (userNested.kind === "object") {
      expect(userNested.children).toHaveLength(2);
      expect(userNested.children[0]!.fieldName).toBe("id");
      expect(userNested.children[1]!.fieldName).toBe("name");
    }
  });

  it("extracts union fields", () => {
    const source = `
import { gql } from "@soda-gql/test";
export const q = gql.default(({ query }) =>
  query("Search")({
    fields: ({ f }) => ({
      ...f("search")({
        User: ({ f }) => ({
          ...f("name")(),
        }),
        Post: ({ f }) => ({
          ...f("title")(),
        }),
        __typename: true,
      }),
    }),
  })({}),
);
`;
    const module = parseSource(source);
    const tree = findAndExtractFieldTree(module as unknown as Node, "default");
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(1);
    const searchField = tree!.children[0]!;
    expect(searchField.fieldName).toBe("search");
    expect(searchField.nested).not.toBeNull();
    const searchNested = searchField.nested!;
    expect(searchNested.kind).toBe("union");
    if (searchNested.kind === "union") {
      expect(searchNested.branches).toHaveLength(2);
      expect(searchNested.branches[0]!.typeName).toBe("User");
      expect(searchNested.branches[0]!.children).toHaveLength(1);
      expect(searchNested.branches[0]!.children[0]!.fieldName).toBe("name");
      expect(searchNested.branches[1]!.typeName).toBe("Post");
      expect(searchNested.branches[1]!.children).toHaveLength(1);
      expect(searchNested.branches[1]!.children[0]!.fieldName).toBe("title");
    }
  });

  it("tracks position — fieldNameSpan slices to fieldName", () => {
    const source = `import { gql } from "@soda-gql/test";
export const q = gql.default(({ query }) =>
  query("GetUser")({
    fields: ({ f }) => ({
      ...f("id")(),
      ...f("name")(),
    }),
  })({}),
);`;
    const module = parseSource(source);
    const converter = createSwcSpanConverter(source);
    const spanOffset = module.span.start;
    const positionCtx: PositionTrackingContext = { spanOffset, converter };
    const tree = findAndExtractFieldTree(module as unknown as Node, "default", positionCtx);
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(2);
    const idField = tree!.children[0]!;
    const nameField = tree!.children[1]!;
    expect(source.slice(idField.fieldNameSpan.start, idField.fieldNameSpan.end)).toBe("id");
    expect(source.slice(nameField.fieldNameSpan.start, nameField.fieldNameSpan.end)).toBe("name");
  });

  it("returns null when no fields property", () => {
    const source = `
import { gql } from "@soda-gql/test";
export const q = gql.default(({ query }) =>
  query("GetUser")({
    variables: \`($id: ID!)\`,
  })({}),
);
`;
    const module = parseSource(source);
    const tree = findAndExtractFieldTree(module as unknown as Node, "default");
    expect(tree).toBeNull();
  });

  it("extractVariablesFromCallbackBuilder and extractFieldCallTree work on the same expression", () => {
    const source = `
import { gql } from "@soda-gql/test";
export const q = gql.default(({ query }) =>
  query("GetUser")({
    variables: \`($id: ID!)\`,
    fields: ({ f }) => ({
      ...f("id")(),
      ...f("name")(),
    }),
  })({}),
);
`;
    const module = parseSource(source);
    const identifiers = collectTestIdentifiers(module);

    // walkAndExtract extracts variables
    const templates = walkAndExtract(module as unknown as Node, identifiers);
    expect(templates).toHaveLength(1);
    expect(templates[0]!.source).toBe("callback-variables");
    expect(templates[0]!.content).toBe("($id: ID!)");

    // extractFieldCallTree extracts field tree
    const tree = findAndExtractFieldTree(module as unknown as Node, "default");
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(2);
    expect(tree!.children[0]!.fieldName).toBe("id");
    expect(tree!.children[1]!.fieldName).toBe("name");
  });
});

/**
 * Test helper: traverse the AST to find the first callback builder expression
 * inside a gql.{schemaName} call, then call extractFieldCallTree on it.
 */
const findAndExtractFieldTree = (root: Node, schemaName: string, positionCtx?: PositionTrackingContext) => {
  // Find gql.{schemaName} call → get the arrow body expression → call extractFieldCallTree
  const visit = (n: Node | ReadonlyArray<Node> | Record<string, unknown>): ReturnType<typeof extractFieldCallTree> => {
    if (!n || typeof n !== "object") return null;

    if ("type" in n && n.type === "CallExpression") {
      const call = n as unknown as {
        callee: { type: string; object?: { type: string; value?: string }; property?: { type: string; value?: string } };
        arguments: { expression?: { type: string; body?: { type: string }; params?: unknown[] } }[];
      };
      if (
        call.callee.type === "MemberExpression" &&
        call.callee.object?.type === "Identifier" &&
        call.callee.property?.type === "Identifier" &&
        call.callee.property.value === schemaName
      ) {
        const arrow = call.arguments[0]?.expression;
        if (arrow?.type === "ArrowFunctionExpression") {
          // Get the body expression from the arrow
          const arrowNode = arrow as unknown as { body: { type: string; stmts?: { type: string; argument?: Node }[] } };
          let bodyExpr: Node | undefined;
          if (arrowNode.body.type === "BlockStatement") {
            for (const stmt of arrowNode.body.stmts ?? []) {
              if (stmt.type === "ReturnStatement" && stmt.argument) {
                bodyExpr = stmt.argument;
                break;
              }
            }
          } else {
            bodyExpr = arrowNode.body as unknown as Node;
          }
          if (bodyExpr) {
            const tree = extractFieldCallTree(bodyExpr, schemaName, positionCtx);
            if (tree !== null) return tree;
          }
        }
      }
    }

    if (Array.isArray(n)) {
      for (const item of n) {
        const result = visit(item as Node);
        if (result !== null) return result;
      }
      return null;
    }

    for (const key of Object.keys(n)) {
      if (key === "span" || key === "type") continue;
      const value = (n as Record<string, unknown>)[key];
      if (value && typeof value === "object") {
        const result = visit(value as Node);
        if (result !== null) return result;
      }
    }

    return null;
  };

  return visit(root);
};
