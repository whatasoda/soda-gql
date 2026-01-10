import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { format, needsFormat } from "./format";

const loadFixture = (name: string): string => {
  const path = resolve(import.meta.dirname, "../test/fixtures", `${name}.ts`);
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
      const source = loadFixture("no-gql");
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
      // variables: { should not have a newline inserted right after the {
      // because it's not a field selection (no ({ f }) pattern)
      expect(code).toContain("variables: { ...$var");
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

describe("fragment key injection", () => {
  it("should inject key for anonymous fragments when enabled", () => {
    const source = `import { gql } from "./graphql";
export const frag = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(true);
    // Key should be injected as first property with newline
    expect(result.value.sourceCode).toMatch(/fragment\.User\(\{ key: "[a-f0-9]{8}",\n/);
  });

  it("should not inject key when option is disabled (default)", () => {
    const source = `import { gql } from "./graphql";
export const frag = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));`;

    const result = format({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // No key property should be added
    expect(result.value.sourceCode).not.toMatch(/key: "/);
  });

  it("should not inject key for fragments that already have one", () => {
    const source = `import { gql } from "./graphql";
export const frag = gql.default(({ fragment }) => fragment.User({ key: "existing", fields: ({ f }) => ({ ...f.id() }) }));`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // Should only have the existing key, not a new one
    const keyMatches = result.value.sourceCode.match(/key:/g);
    expect(keyMatches?.length).toBe(1);
    expect(result.value.sourceCode).toContain('key: "existing"');
  });

  it("should not inject key for query/mutation operations", () => {
    const source = `import { gql } from "./graphql";
export const op = gql.default(({ query }) => query.operation({ name: "GetUsers", fields: ({ f }) => ({ ...f.id() }) }));`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // Operations use name, not key - should not have key injected
    expect(result.value.sourceCode).not.toMatch(/key: "[a-f0-9]{8}"/);
  });

  it("should inject unique keys for multiple fragments", () => {
    const source = `import { gql } from "./graphql";
export const frag1 = gql.default(({ fragment }) => fragment.User({ fields: ({ f }) => ({ ...f.id() }) }));
export const frag2 = gql.default(({ fragment }) => fragment.Post({ fields: ({ f }) => ({ ...f.title() }) }));`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    const keyMatches = result.value.sourceCode.match(/key: "([a-f0-9]{8})"/g);
    expect(keyMatches?.length).toBe(2);

    // Keys should be unique
    const keys = keyMatches?.map((m) => m.match(/"([a-f0-9]{8})"/)?.[1]);
    expect(keys?.[0]).not.toBe(keys?.[1]);
  });

  it("should work with renamed fragment destructuring", () => {
    const source = `import { gql } from "./graphql";
export const frag = gql.default(({ fragment: f }) => f.User({ fields: ({ f }) => ({ ...f.id() }) }));`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(true);
    expect(result.value.sourceCode).toMatch(/f\.User\(\{ key: "[a-f0-9]{8}",\n/);
  });

  it("should work with multi-schema patterns", () => {
    const source = `import { gql } from "./graphql";
export const frag = gql.admin(({ fragment }) => fragment.Post({ fields: ({ f }) => ({ ...f.id() }) }));`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(true);
    expect(result.value.sourceCode).toMatch(/fragment\.Post\(\{ key: "[a-f0-9]{8}",\n/);
  });

  it("should preserve indentation for multi-line fragment objects", () => {
    const source = `import { gql } from "./graphql";
export const frag = gql.default(({ fragment }) => fragment.User({
  fields: ({ f }) => ({ ...f.id() })
}));`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(true);
    // Key should be on its own line with proper indentation
    expect(result.value.sourceCode).toContain(`fragment.User({
  key: "`);
    // Verify fields is still properly indented
    expect(result.value.sourceCode).toMatch(/key: "[a-f0-9]{8}",\n {2}fields:/);
  });

  it("should handle tabs as indentation", () => {
    const source = `import { gql } from "./graphql";
export const frag = gql.default(({ fragment }) => fragment.User({
\tfields: ({ f }) => ({ ...f.id() })
}));`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value.modified).toBe(true);
    expect(result.value.sourceCode).toContain(`fragment.User({
\tkey: "`);
  });

  it("should handle deeply nested indentation", () => {
    const source = `import { gql } from "./graphql";
const x = {
  y: {
    frag: gql.default(({ fragment }) => fragment.User({
      fields: ({ f }) => ({ ...f.id() })
    }))
  }
};`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // Should detect 6-space indentation (inside the nested objects)
    expect(result.value.sourceCode).toMatch(/fragment\.User\(\{\n {6}key: "[a-f0-9]{8}",\n {6}fields:/);
  });

  it("should not add extra blank lines for multi-line fragments", () => {
    const source = `import { gql } from "./graphql";
export const frag = gql.default(({ fragment }) => fragment.User({
  fields: ({ f }) => ({ ...f.id() })
}));`;

    const result = format({ sourceCode: source, injectFragmentKeys: true });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    // Should not have double newlines after key injection
    expect(result.value.sourceCode).not.toContain(",\n\n");
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
    const source = loadFixture("no-gql");
    const result = needsFormat({ sourceCode: source });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;

    expect(result.value).toBe(false);
  });
});
