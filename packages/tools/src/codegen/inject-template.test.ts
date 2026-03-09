import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getInjectTemplate, writeInjectTemplate } from "./inject-template";

describe("writeInjectTemplate", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `codegen-inject-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("writes template to new file", () => {
    const outPath = join(tempDir, "scalars.ts");

    const result = writeInjectTemplate(outPath);

    expect(result.isOk()).toBe(true);
    expect(existsSync(outPath)).toBe(true);

    const content = readFileSync(outPath, "utf-8");
    expect(content).toContain("defineScalar");
    expect(content).toContain("@soda-gql/core");
  });

  test("returns error if file already exists", () => {
    const outPath = join(tempDir, "existing.ts");
    writeFileSync(outPath, "existing content");

    const result = writeInjectTemplate(outPath);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("INJECT_TEMPLATE_EXISTS");
      expect(result.error.message).toContain("already exists");
    }

    // Original content should be preserved
    expect(readFileSync(outPath, "utf-8")).toBe("existing content");
  });

  test("creates parent directories", () => {
    const outPath = join(tempDir, "nested", "dir", "scalars.ts");

    const result = writeInjectTemplate(outPath);

    expect(result.isOk()).toBe(true);
    expect(existsSync(outPath)).toBe(true);
  });

  test("template contains all builtin scalar types", () => {
    const outPath = join(tempDir, "scalars.ts");
    writeInjectTemplate(outPath);

    const content = readFileSync(outPath, "utf-8");
    expect(content).toContain('"ID"');
    expect(content).toContain('"String"');
    expect(content).toContain('"Int"');
    expect(content).toContain('"Float"');
    expect(content).toContain('"Boolean"');
  });

  test("template exports scalar constant", () => {
    const outPath = join(tempDir, "scalars.ts");
    writeInjectTemplate(outPath);

    const content = readFileSync(outPath, "utf-8");
    expect(content).toContain("export const scalar");
    expect(content).toContain("as const");
  });
});

describe("getInjectTemplate", () => {
  test("returns template string", () => {
    const template = getInjectTemplate();

    expect(typeof template).toBe("string");
    expect(template.length).toBeGreaterThan(0);
  });

  test("template contains defineScalar import", () => {
    const template = getInjectTemplate();

    expect(template).toContain('import { defineScalar } from "@soda-gql/core"');
  });

  test("template contains all builtin scalars", () => {
    const template = getInjectTemplate();

    expect(template).toContain("ID");
    expect(template).toContain("String");
    expect(template).toContain("Int");
    expect(template).toContain("Float");
    expect(template).toContain("Boolean");
  });

  test("template is valid TypeScript syntax", () => {
    const template = getInjectTemplate();

    // Basic syntax check - should have balanced braces
    const openBraces = (template.match(/{/g) || []).length;
    const closeBraces = (template.match(/}/g) || []).length;
    expect(openBraces).toBe(closeBraces);

    // Should export scalar
    expect(template).toContain("export const scalar");
  });

  test("returns consistent template", () => {
    const template1 = getInjectTemplate();
    const template2 = getInjectTemplate();

    expect(template1).toBe(template2);
  });
});
