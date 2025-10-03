import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAstAnalyzer } from "../../../packages/builder/src/ast";

const analyzeModule = getAstAnalyzer("ts").analyze;

const fixturesDir = join(__dirname, "../../fixtures/module-analysis/ts");
const loadFixture = (name: string) => {
  const fixturePath = join(fixturesDir, `${name}.ts`);
  return {
    filePath: fixturePath,
    source: readFileSync(fixturePath, "utf-8"),
  };
};

describe("Module analyzer - TypeScript", () => {
  it("extracts top-level gql definitions with schema metadata", () => {
    const { filePath, source } = loadFixture("top-level-with-metadata");

    const analysis = analyzeModule({ filePath, source });

    const summary = analysis.definitions.map((definition) => ({
      exportName: definition.exportName,
    }));

    expect(summary).toEqual([{ exportName: "userModel" }, { exportName: "userSlice" }, { exportName: "pageQuery" }]);
  });

  it("collects gql definitions nested inside non-top-level scopes", () => {
    const { filePath, source } = loadFixture("nested-non-top-level");

    const analysis = analyzeModule({ filePath, source });

    // Now nested definitions are supported
    expect(analysis.definitions).toHaveLength(1);
    const [definition] = analysis.definitions;
    expect(definition).toBeDefined();
    expect(definition?.astPath).toBe("buildSlice.arrow#0.invalid");
    expect(definition?.isTopLevel).toBe(false);
    expect(definition?.isExported).toBe(false);
    expect(definition?.exportBinding).toBeUndefined();

    // No diagnostics emitted for nested definitions
    expect(analysis.diagnostics).toHaveLength(0);
  });

  it("captures references to imported slices and models", () => {
    const { filePath, source } = loadFixture("imported-slice-refs");

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toHaveLength(1);
    const [pageQuery] = analysis.definitions;
    expect(pageQuery).toBeDefined();
    expect(pageQuery?.exportName).toBe("pageQuery");
  });

  it("captures nested dependencies for slices", () => {
    const { filePath, source } = loadFixture("nested-namespace-deps");

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toHaveLength(1);
    const [pageQuery] = analysis.definitions;
    expect(pageQuery).toBeDefined();
    expect(pageQuery?.exportName).toBe("pageQuery");
  });

  it("captures references in nested object values", () => {
    const { filePath, source } = loadFixture("nested-object-values");

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toHaveLength(1);
    const [complexQuery] = analysis.definitions;
    expect(complexQuery).toBeDefined();
    expect(complexQuery?.exportName).toBe("complexQuery");
  });

  it("captures both local and imported dependencies", () => {
    const { filePath, source } = loadFixture("local-and-imported-deps");

    const analysis = analyzeModule({ filePath, source });

    const pageQuery = analysis.definitions.find((def) => def.exportName === "pageQuery");
    expect(pageQuery?.exportName).toBe("pageQuery");
  });

  it("extracts definitions from multiple schemas", () => {
    const { filePath, source } = loadFixture("multiple-schemas");

    const analysis = analyzeModule({ filePath, source });

    const summary = analysis.definitions.map((definition) => ({
      exportName: definition.exportName,
    }));

    expect(summary).toEqual([{ exportName: "adminModel" }, { exportName: "defaultQuery" }]);
  });
});
