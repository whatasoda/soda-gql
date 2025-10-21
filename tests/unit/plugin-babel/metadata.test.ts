import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { types as t } from "@babel/core";
import { parseSync, traverse } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { collectGqlDefinitionMetadata } from "../../../packages/plugin-babel/src/internal/ast/metadata";

const collectMetadata = (source: string, filename: string) => {
  const ast = parseSync(source, {
    filename,
    parserOpts: { sourceType: "module", plugins: ["typescript"] },
  });

  if (!ast) throw new Error("Failed to parse");

  let programPath: NodePath<t.Program> | null = null;
  traverse(ast, {
    Program(path) {
      programPath = path;
      path.stop();
    },
  });

  if (!programPath) throw new Error("No Program node found");

  const metadataMap = collectGqlDefinitionMetadata({
    programPath,
    filename,
  });

  // Convert WeakMap to array by collecting all CallExpression nodes
  const entries: Array<{ astPath: string; isTopLevel: boolean; isExported: boolean; exportBinding?: string }> = [];
  traverse(ast, {
    CallExpression(path) {
      const metadata = metadataMap.get(path.node);
      if (metadata) {
        entries.push(metadata);
      }
    },
  });

  return entries;
};

describe("collectGqlDefinitionMetadata", () => {
  it("should collect metadata for ESM exports", () => {
    const source = `
      import { gql } from "@soda-gql/core";

      export const getUserQuery = gql.default(({ operation }) =>
        operation.query({ operationName: "GetUser" }, () => ({}))
      );
    `;

    const entries = collectMetadata(source, "/test/esm.ts");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.astPath).toBe("getUserQuery");
    expect(entries[0]?.isTopLevel).toBe(true);
    expect(entries[0]?.isExported).toBe(true);
    expect(entries[0]?.exportBinding).toBe("getUserQuery");
  });

  it("should collect metadata for CommonJS exports", () => {
    const fixtureSource = readFileSync(join(__dirname, "../../fixtures/plugin-babel/exports/commonjs/source.ts"), "utf-8");

    const entries = collectMetadata(fixtureSource, "/test/commonjs.ts");

    expect(entries).toHaveLength(2);

    // Check that both exports have correct canonical paths
    const astPaths = entries.map((e) => e.astPath).sort();
    expect(astPaths).toContain("updateUserMutation");
    expect(astPaths).toContain("getUserQuery");

    // Check export bindings
    for (const entry of entries) {
      expect(entry.isTopLevel).toBe(true);
      expect(entry.isExported).toBe(true);
      if (entry.exportBinding) {
        expect(["updateUserMutation", "getUserQuery"]).toContain(entry.exportBinding);
        expect(entry.astPath).toBe(entry.exportBinding);
      }
    }
  });

  it("should handle nested gql calls in ESM", () => {
    const source = `
      import { gql } from "@soda-gql/core";

      const wrapper = () => {
        const nested = gql.default(({ operation }) => operation.query({ operationName: "Nested" }, () => ({})));
        return nested;
      };
    `;

    const entries = collectMetadata(source, "/test/nested-esm.ts");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.astPath).toContain("wrapper");
    expect(entries[0]?.astPath).toContain("nested");
    expect(entries[0]?.isTopLevel).toBe(false);
    expect(entries[0]?.isExported).toBe(false);
  });

  it("should handle module.exports pattern", () => {
    const source = `
      const graphql_system_1 = { gql: { default: (() => {}) } };

      module.exports.myQuery = graphql_system_1.gql.default(({ operation }) =>
        operation.query({ operationName: "MyQuery" }, () => ({}))
      );
    `;

    const entries = collectMetadata(source, "/test/module-exports.ts");

    expect(entries).toHaveLength(1);
    expect(entries[0]?.astPath).toBe("myQuery");
    expect(entries[0]?.isTopLevel).toBe(true);
    expect(entries[0]?.isExported).toBe(true);
    expect(entries[0]?.exportBinding).toBe("myQuery");
  });
});
