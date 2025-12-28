import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format, needsFormat } from "../src/format";

const loadFixture = (name: string): string => {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", `${name}.ts`);
  return readFileSync(path, "utf-8");
};

describe("format", () => {
  describe("basic formatting", () => {
    it("should insert empty comments in field selection arrays", () => {
      const source = loadFixture("needs-format");
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(true);
      // Check that empty comments were added
      expect(result.value.sourceCode).toContain("//");
    });

    it("should not modify already formatted arrays", () => {
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
      // Check that empty comments were added to all schema field selections
      expect(result.value.sourceCode).toContain("//");
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

  describe("config arrays", () => {
    it("should only format field selection arrays, not config arrays", () => {
      const source = loadFixture("config-arrays");
      const result = format({ sourceCode: source });

      expect(result.isOk()).toBe(true);
      if (!result.isOk()) return;

      expect(result.value.modified).toBe(true);

      // The field selection array should have empty comment
      // But the variables array should NOT
      const code = result.value.sourceCode;
      const variablesMatch = code.match(/variables:\s*\[\s*\/\//);
      expect(variablesMatch).toBeNull();
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
