import { describe, expect, test } from "bun:test";
import { Script } from "node:vm";
import type { ModuleAnalysis, ModuleDefinition } from "../ast";
import { generateIntermediateModules } from "./evaluation";
import { createCanonicalId } from "@soda-gql/common/canonical-id/canonical-id";

// Test graphql-system path that won't match any test module paths
const TEST_GRAPHQL_SYSTEM_PATH = "/test/graphql-system/index.ts";

const createTestAnalysis = (
  filePath: string,
  definitions: Array<{ localPath: string; expression: string; dependencies?: string[] }>,
): ModuleAnalysis => {
  const defs: ModuleDefinition[] = definitions.map(({ localPath, expression }) => ({
    canonicalId: createCanonicalId(filePath, localPath),
    astPath: localPath,
    isTopLevel: true,
    isExported: true,
    expression,
    loc: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
  }));

  return {
    filePath,
    signature: "test-sig",
    definitions: defs,
    imports: [],
    exports: [],
  };
};

describe("generateIntermediateModules", () => {
  test("should create single module for single file", () => {
    const analyses = new Map([
      ["/src/a.ts", createTestAnalysis("/src/a.ts", [{ localPath: "foo", expression: "gql.default({ name: 'Foo' })" }])],
    ]);

    const result = new Map();
    for (const module of generateIntermediateModules({
      analyses,
      targetFiles: new Set(["/src/a.ts"]),
      graphqlSystemPath: TEST_GRAPHQL_SYSTEM_PATH,
    })) {
      result.set(module.filePath, module);
    }

    expect(result.size).toBe(1);
    expect(result.has("/src/a.ts")).toBe(true);

    const module = result.get("/src/a.ts");
    expect(module).toBeDefined();
    expect(module?.filePath).toBe("/src/a.ts");
    expect(module?.canonicalIds).toHaveLength(1);
    expect(module?.sourceCode).toContain("gql.default({ name: 'Foo' })");
    expect(module?.script).toBeDefined();
    expect(module?.transpiledCode).toBeDefined();
  });

  test("should create multiple modules for multiple files", () => {
    const analyses = new Map([
      ["/src/a.ts", createTestAnalysis("/src/a.ts", [{ localPath: "foo", expression: "gql.default({ name: 'Foo' })" }])],
      ["/src/b.ts", createTestAnalysis("/src/b.ts", [{ localPath: "bar", expression: "gql.default({ name: 'Bar' })" }])],
    ]);

    const result = new Map();
    for (const module of generateIntermediateModules({
      analyses,
      targetFiles: new Set(["/src/a.ts", "/src/b.ts"]),
      graphqlSystemPath: TEST_GRAPHQL_SYSTEM_PATH,
    })) {
      result.set(module.filePath, module);
    }

    expect(result.size).toBe(2);
    expect(result.has("/src/a.ts")).toBe(true);
    expect(result.has("/src/b.ts")).toBe(true);
  });

  test("should group multiple definitions from same file in one module", () => {
    const analyses = new Map([
      [
        "/src/a.ts",
        createTestAnalysis("/src/a.ts", [
          { localPath: "foo", expression: "gql.default({ name: 'Foo' })" },
          { localPath: "bar", expression: "gql.default({ name: 'Bar' })" },
        ]),
      ],
    ]);

    const result = new Map();
    for (const module of generateIntermediateModules({
      analyses,
      targetFiles: new Set(["/src/a.ts"]),
      graphqlSystemPath: TEST_GRAPHQL_SYSTEM_PATH,
    })) {
      result.set(module.filePath, module);
    }

    expect(result.size).toBe(1);

    const module = result.get("/src/a.ts");
    expect(module?.canonicalIds).toHaveLength(2);
    expect(module?.sourceCode).toContain("gql.default({ name: 'Foo' })");
    expect(module?.sourceCode).toContain("gql.default({ name: 'Bar' })");
  });

  test("should compute stable content hashes for unchanged modules", () => {
    const analyses = new Map([
      ["/src/a.ts", createTestAnalysis("/src/a.ts", [{ localPath: "foo", expression: "gql.default({ name: 'Foo' })" }])],
    ]);

    const result1 = new Map();
    for (const module of generateIntermediateModules({
      analyses,
      targetFiles: new Set(["/src/a.ts"]),
      graphqlSystemPath: TEST_GRAPHQL_SYSTEM_PATH,
    })) {
      result1.set(module.filePath, module);
    }

    const result2 = new Map();
    for (const module of generateIntermediateModules({
      analyses,
      targetFiles: new Set(["/src/a.ts"]),
      graphqlSystemPath: TEST_GRAPHQL_SYSTEM_PATH,
    })) {
      result2.set(module.filePath, module);
    }

    const module1 = result1.get("/src/a.ts");
    const module2 = result2.get("/src/a.ts");

    expect(module1?.contentHash).toBeDefined();
    expect(module2?.contentHash).toBeDefined();
    if (module1?.contentHash && module2?.contentHash) {
      expect(module1.contentHash).toBe(module2.contentHash);
    }
  });

  test("should generate valid transpiled code", () => {
    const analyses = new Map([
      ["/src/a.ts", createTestAnalysis("/src/a.ts", [{ localPath: "foo", expression: "gql.default({ name: 'Foo' })" }])],
    ]);

    const result = new Map();
    for (const module of generateIntermediateModules({
      analyses,
      targetFiles: new Set(["/src/a.ts"]),
      graphqlSystemPath: TEST_GRAPHQL_SYSTEM_PATH,
    })) {
      result.set(module.filePath, module);
    }

    const module = result.get("/src/a.ts");
    expect(module?.transpiledCode).toBeDefined();
    expect(module?.transpiledCode).not.toContain(": string"); // TypeScript types should be stripped
    expect(module?.script).toBeInstanceOf(Script);
  });
});
