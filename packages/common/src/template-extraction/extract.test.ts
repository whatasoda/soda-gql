import { describe, expect, it } from "bun:test";
import { parseSync } from "@swc/core";
import type { Module, Node } from "@swc/types";
import { createSwcSpanConverter } from "../utils/swc-span";
import { isOperationKind, OPERATION_KINDS, type PositionTrackingContext, walkAndExtract } from "./extract";

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
