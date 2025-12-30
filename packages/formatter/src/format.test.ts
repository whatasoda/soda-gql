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
