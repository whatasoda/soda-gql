import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { format, needsFormat } from "./format";

const loadFixture = (name: string, category: "valid" | "invalid" = "valid"): string => {
  const path = resolve(import.meta.dirname, `../../test/formatter/fixture-catalog/fixtures/formatting/${category}`, `${name}.ts`);
  return readFileSync(path, "utf-8");
};

describe("format", () => {
  describe("basic formatting", () => {
    it("should insert newlines in field selection objects", () => {
      const source = loadFixture("needs-format");
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(true);
      // Check that newlines were added after opening braces of field selections
      // The source has `({ f }) => ({` patterns that should become `({ f }) => ({\n`
      const fieldSelectionPattern = /\(\{ f(?:, \$)? \}\) => \(\{\n/g;
      const matches = result.value.sourceCode.match(fieldSelectionPattern);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThan(0);
    });

    it("should not modify already formatted objects", () => {
      const source = loadFixture("already-formatted");
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(false);
      expect(result.value.sourceCode).toBe(source);
    });

    it("should not modify files without gql.default", () => {
      const source = loadFixture("no-gql", "invalid");
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(false);
      expect(result.value.sourceCode).toBe(source);
    });
  });

  describe("multi-schema support", () => {
    it("should format multi-schema files (gql.admin, gql.default, etc.)", () => {
      const source = loadFixture("multi-schema");
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(true);
      // Check that newlines were added to all schema field selections
      const fieldSelectionPattern = /\(\{ f(?:, \$)? \}\) => \(\{\n/g;
      const matches = result.value.sourceCode.match(fieldSelectionPattern);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThan(0);
    });

    it("should not modify already formatted multi-schema files", () => {
      const source = loadFixture("multi-schema-formatted");
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(false);
      expect(result.value.sourceCode).toBe(source);
    });
  });

  describe("config objects", () => {
    it("should only format field selection objects, not variables objects", () => {
      const source = loadFixture("config-arrays");
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(true);

      // The field selection object should have newline
      // But the variables object should NOT (it's not a field selection)
      const code = result.value.sourceCode;
      // variables template literal should not be modified by the formatter
      expect(code).toContain("variables: `($id: ID!)`");
    });
  });

  describe("multi-byte character handling", () => {
    it("should correctly format field selections after multi-byte characters", () => {
      const source = `import { gql } from "./graphql";
// 日本語コメント: テスト用のミューテーション
export const op = gql.default(({ query }) =>
  query("GetUser")({ fields: ({ f }) => ({ ...f("id")(), ...f("name")() }) })()
);`;
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(true);
      // Verify no corruption — the method names should be intact
      expect(result.value.sourceCode).toContain('...f("id")()');
      expect(result.value.sourceCode).toContain('...f("name")()');
      // Verify newline was inserted after { in field selection
      expect(result.value.sourceCode).toMatch(/\(\{ f \}\) => \(\{\n/);
    });

    it("should handle emoji and CJK characters before field selections", () => {
      const source = `import { gql } from "./graphql";
// 🎉 テスト: 絵文字とCJK文字のテスト
export const op = gql.default(({ query }) =>
  query("Test")({ fields: ({ f }) => ({ ...f("id")() }) })()
);`;
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(true);
      expect(result.value.sourceCode).toContain('...f("id")()');
      expect(result.value.sourceCode).toMatch(/\(\{ f \}\) => \(\{\n/);
    });
  });

  describe("error handling", () => {
    it("should return parse error for invalid syntax", () => {
      const source = "const x = {";
      const result = format({ sourceCode: source, filePath: "test.ts" });

      expect(result.isErr()).toBe(true);
      if (!result.isErr()) return;

      expect(result.error.type).toBe("FormatError");
      expect(result.error.code).toBe("PARSE_ERROR");
      expect(result.error.message).toContain("test.ts");
    });
  });
});

describe("tagged template formatting", () => {
  it("should format single-line tagged template query to multi-line", () => {
    const source = `import { gql } from "./graphql";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id name } }\`
);`;
    const result = format({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(true);
    expect(result.value.sourceCode).toContain("id");
    expect(result.value.sourceCode).toContain("name");
  });

  it("should handle mixed callback builder + tagged template", () => {
    const source = `import { gql } from "./graphql";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id name } }\`
);
export const GetPost = gql.default(({ query }) =>
  query("GetPost")({ fields: ({ f }) => ({ ...f("id")(), ...f("title")() }) })()
);`;
    const result = format({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(true);
    // Both tagged template and callback builder should be formatted
    expect(result.value.sourceCode).toContain("id");
    expect(result.value.sourceCode).toContain("name");
    // Callback builder field selection should have newline inserted
    const fieldSelectionPattern = /\(\{ f \}\) => \(\{\n/g;
    const matches = result.value.sourceCode.match(fieldSelectionPattern);
    expect(matches).not.toBeNull();
  });

  it("should not modify already-formatted tagged templates", () => {
    const source = `import { gql } from "./graphql";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{
  user {
    id
    name
  }
}\`
);`;
    const result = format({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(false);
    expect(result.value.sourceCode).toBe(source);
  });

  it("should handle bare-tag syntax", () => {
    const source = `import { gql } from "./graphql";
export const GetUser = gql.default(({ query }) =>
  query\`query GetUser { user { id name } }\`
);`;
    const result = format({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(true);
    expect(result.value.sourceCode).toContain("id");
    expect(result.value.sourceCode).toContain("name");
  });

  it("should handle fragment with curried syntax", () => {
    const source = `import { gql } from "./graphql";
export const UserFields = gql.default(({ fragment }) =>
  fragment("UserFields", "User")\`{ id name email }\`
);`;
    const result = format({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(true);
    expect(result.value.sourceCode).toContain("id");
    expect(result.value.sourceCode).toContain("name");
    expect(result.value.sourceCode).toContain("email");
  });
});

describe("needsFormat with tagged templates", () => {
  it("should return true when tagged templates need formatting", () => {
    const source = `import { gql } from "./graphql";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id name } }\`
);`;
    const result = needsFormat({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value).toBe(true);
  });

  it("should return false when tagged templates are already formatted", () => {
    const source = `import { gql } from "./graphql";
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{
  user {
    id
    name
  }
}\`
);`;
    const result = needsFormat({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value).toBe(false);
  });
});

describe("needsFormat", () => {
  it("should return true for files needing formatting", () => {
    const source = loadFixture("needs-format");
    const result = needsFormat({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value).toBe(true);
  });

  it("should return false for already formatted files", () => {
    const source = loadFixture("already-formatted");
    const result = needsFormat({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value).toBe(false);
  });

  it("should return false for files without gql.default", () => {
    const source = loadFixture("no-gql", "invalid");
    const result = needsFormat({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value).toBe(false);
  });

  it("should correctly detect unformatted field selections after multi-byte characters", () => {
    const source = `import { gql } from "./graphql";
// 日本語コメント
export const op = gql.default(({ query }) =>
  query("Test")({ fields: ({ f }) => ({ ...f("id")() }) })()
);`;
    const result = needsFormat({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value).toBe(true);
  });
});

describe("idempotency", () => {
  it("should return modified: false when formatting an already-formatted result", () => {
    const source = `import { gql } from "./graphql";
export const op = gql.default(({ query }) =>
  query("Test")({ fields: ({ f }) => ({ ...f("id")(), ...f("name")() }) })()
);`;
    const first = format({ sourceCode: source });
    expect(first.isOk()).toBe(true);
    if (!first.isOk()) return;
    expect(first.value.modified).toBe(true);

    const second = format({ sourceCode: first.value.sourceCode });
    expect(second.isOk()).toBe(true);
    if (!second.isOk()) return;
    expect(second.value.modified).toBe(false);
  });

  it("should be idempotent with multi-byte characters", () => {
    const source = `import { gql } from "./graphql";
// 🎉 テスト
export const op = gql.default(({ query }) =>
  query("Test")({ fields: ({ f }) => ({ ...f("id")() }) })()
);`;
    const first = format({ sourceCode: source });
    expect(first.isOk()).toBe(true);
    if (!first.isOk()) return;

    const second = format({ sourceCode: first.value.sourceCode });
    expect(second.isOk()).toBe(true);
    if (!second.isOk()) return;
    expect(second.value.modified).toBe(false);
  });

  it("should be idempotent with mixed callback builder and tagged template", () => {
    const source = `import { gql } from "./graphql";
// 日本語コメント: 混合テスト
export const GetUser = gql.default(({ query }) =>
  query("GetUser")\`{ user { id name } }\`
);
export const GetPost = gql.default(({ query }) =>
  query("GetPost")({ fields: ({ f }) => ({ ...f("id")(), ...f("title")() }) })()
);`;
    const first = format({ sourceCode: source });
    expect(first.isOk()).toBe(true);
    if (!first.isOk()) return;

    const second = format({ sourceCode: first.value.sourceCode });
    expect(second.isOk()).toBe(true);
    if (!second.isOk()) return;
    expect(second.value.modified).toBe(false);
  });

  it("should be idempotent with multi-line tagged template fragment", () => {
    const source = `import { gql } from "./graphql";
export const Foo = gql.default(({ fragment }) =>
  fragment("Foo", "Bar")\`{
    id
    name
  }\`(),
);`;
    const first = format({ sourceCode: source });
    expect(first.isOk()).toBe(true);
    if (!first.isOk()) return;

    const second = format({ sourceCode: first.value.sourceCode });
    expect(second.isOk()).toBe(true);
    if (!second.isOk()) return;
    expect(second.value.modified).toBe(false);
  });

  it("should be idempotent with multi-line tagged template query", () => {
    const source = `import { gql } from "./graphql";
export const GetUsers = gql.default(({ query }) =>
  query("GetUsers")\`{
    employees {
      id
      name
    }
  }\`
);`;
    const first = format({ sourceCode: source });
    expect(first.isOk()).toBe(true);
    if (!first.isOk()) return;

    const second = format({ sourceCode: first.value.sourceCode });
    expect(second.isOk()).toBe(true);
    if (!second.isOk()) return;
    expect(second.value.modified).toBe(false);
  });

  it("should be idempotent with tagged template content ending with newline", () => {
    const source = `import { gql } from "./graphql";
export const Foo = gql.default(({ fragment }) =>
  fragment("Foo", "Bar")\`{
    id
    name
  }
\`(),
);`;
    const first = format({ sourceCode: source });
    expect(first.isOk()).toBe(true);
    if (!first.isOk()) return;

    const second = format({ sourceCode: first.value.sourceCode });
    expect(second.isOk()).toBe(true);
    if (!second.isOk()) return;
    expect(second.value.modified).toBe(false);
  });
});
