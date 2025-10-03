import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getAstAnalyzer } from "../../../packages/builder/src/ast";

const analyzeModule = getAstAnalyzer("swc").analyze;

const fixturesDir = join(__dirname, "../../fixtures/module-analysis/swc");
const loadFixture = (name: string) => {
  const fixturePath = join(fixturesDir, `${name}.ts`);
  return {
    filePath: fixturePath,
    source: readFileSync(fixturePath, "utf-8"),
  };
};

describe("module analysis (swc)", () => {
  it("extracts top-level definitions", () => {
    const { filePath, source } = loadFixture("top-level-definitions");

    const analysis = analyzeModule({ filePath, source });
    const names = analysis.definitions.map((item) => item.astPath);
    expect(names).toContain("pageQuery");
  });

  it("extracts definitions from object property exports", () => {
    const { filePath, source } = loadFixture("object-property-exports");

    const analysis = analyzeModule({ filePath, source });
    const names = analysis.definitions.map((item) => item.astPath);
    expect(names).toContain("user_remoteModel.forIterate");
    expect(analysis.diagnostics).toHaveLength(0);
  });

  it("collects nested definitions inside functions", () => {
    const { filePath, source } = loadFixture("nested-in-functions");

    const analysis = analyzeModule({ filePath, source });
    expect(analysis.definitions).toHaveLength(1);
    const [definition] = analysis.definitions;
    expect(definition?.isTopLevel).toBe(false);
    expect(definition?.isExported).toBe(false);
    expect(analysis.diagnostics).toHaveLength(0);
  });

  it("captures references to properties on imported bindings", () => {
    const { filePath, source } = loadFixture("imported-binding-refs");

    const analysis = analyzeModule({ filePath, source });
    const definition = analysis.definitions.find((item) => item.astPath === "pageQuery");
    expect(definition?.astPath).toBe("pageQuery");
  });

  it("captures deep member references from namespace imports", () => {
    const { filePath, source } = loadFixture("namespace-imports");

    const analysis = analyzeModule({ filePath, source });
    const definition = analysis.definitions.find((item) => item.astPath === "pageQuery");
    expect(definition?.astPath).toBe("pageQuery");
  });
});
