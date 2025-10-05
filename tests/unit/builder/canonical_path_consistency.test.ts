import { describe, expect, it } from "bun:test";
import { getAstAnalyzer } from "../../../packages/builder/src/ast";
import { loadModuleAnalysisFixture } from "../../utils";

describe("Canonical path consistency", () => {
  // Helper to safely access array elements while satisfying linter
  function expectDefinition<T>(array: readonly T[], index: number): T {
    const value = array[index];
    if (value === undefined) {
      throw new Error(`Missing definition at index ${index}`);
    }
    return value;
  }

  const loadFixture = (name: string) => loadModuleAnalysisFixture("shared", name);

  describe("TypeScript and SWC adapters produce consistent astPath", () => {
    const analyzeWithTS = getAstAnalyzer("ts").analyze;
    const analyzeWithSWC = getAstAnalyzer("swc").analyze;

    it("generates same astPath for top-level definitions", () => {
      const { filePath, source } = loadFixture("top-level-simple");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      const tsDef = expectDefinition(tsAnalysis.definitions, 0);
      const swcDef = expectDefinition(swcAnalysis.definitions, 0);
      expect(tsDef.astPath).toBe(swcDef.astPath);
      expect(tsDef.astPath).toBe("userModel");
    });

    it("generates same astPath for nested definitions in functions", () => {
      const { filePath, source } = loadFixture("nested-in-function");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      const tsDef = expectDefinition(tsAnalysis.definitions, 0);
      const swcDef = expectDefinition(swcAnalysis.definitions, 0);
      expect(tsDef.astPath).toBe(swcDef.astPath);
      expect(tsDef.astPath).toBe("createModels.nested");
    });

    it("generates same astPath for definitions in arrow functions", () => {
      const { filePath, source } = loadFixture("arrow-function");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      const tsDef = expectDefinition(tsAnalysis.definitions, 0);
      const swcDef = expectDefinition(swcAnalysis.definitions, 0);
      expect(tsDef.astPath).toBe(swcDef.astPath);
      // Arrow functions get auto-numbered names
      expect(tsDef.astPath).toMatch(/^factory\.arrow#\d+\.model$/);
    });

    it("generates same astPath for class method definitions (TypeScript only)", () => {
      const { filePath, source } = loadFixture("class-method");

      const tsAnalysis = analyzeWithTS({ filePath, source });

      // Note: SWC adapter may not fully support class method traversal
      // This test focuses on TypeScript adapter behavior
      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(tsAnalysis.definitions[0]?.astPath).toBe("UserRepository.getModels.model");
    });

    it("generates same astPath for object property definitions", () => {
      const { filePath, source } = loadFixture("object-property");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      const tsDef = expectDefinition(tsAnalysis.definitions, 0);
      const swcDef = expectDefinition(swcAnalysis.definitions, 0);
      expect(tsDef.astPath).toBe(swcDef.astPath);
      expect(tsDef.astPath).toBe("config.models.user");
    });

    it("handles duplicate names with unique suffixes", () => {
      const { filePath, source } = loadFixture("duplicate-names");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(4);
      expect(swcAnalysis.definitions).toHaveLength(4);

      for (let i = 0; i < 4; i++) {
        const tsDef = expectDefinition(tsAnalysis.definitions, i);
        const swcDef = expectDefinition(swcAnalysis.definitions, i);
        expect(tsDef.astPath).toBe(swcDef.astPath);
      }

      // Top-level model1 and model2
      expect(tsAnalysis.definitions[0]?.astPath).toBe("model1");
      expect(tsAnalysis.definitions[1]?.astPath).toBe("model2");

      // Nested model1 and model2 in factory function
      expect(tsAnalysis.definitions[2]?.astPath).toBe("factory.model1");
      expect(tsAnalysis.definitions[3]?.astPath).toBe("factory.model2");
    });
  });

  describe("Export binding detection", () => {
    const analyzeWithTS = getAstAnalyzer("ts").analyze;

    it("detects exported definitions", () => {
      const { filePath, source } = loadFixture("exported-and-private");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(2);

      const userModel = analysis.definitions.find((d) => d.astPath === "userModel");
      const privateModel = analysis.definitions.find((d) => d.astPath === "privateModel");

      expect(userModel?.isExported).toBe(true);
      expect(userModel?.exportBinding).toBe("userModel");

      expect(privateModel?.isExported).toBe(false);
      expect(privateModel?.exportBinding).toBeUndefined();
    });

    it("detects exported function declarations", () => {
      const { filePath, source } = loadFixture("exported-function");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(1);
      // The definition is in a variable inside the function
      expect(analysis.definitions[0]?.astPath).toBe("getModel.model");
      expect(analysis.definitions[0]?.isTopLevel).toBe(false);
    });
  });

  describe("Complex nesting scenarios", () => {
    const analyzeWithTS = getAstAnalyzer("ts").analyze;

    it("handles deeply nested definitions", () => {
      const { filePath, source } = loadFixture("deeply-nested");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(1);
      expect(analysis.definitions[0]?.astPath).toBe("Outer.method.obj.nested.deep");
    });

    it("handles multiple definitions in same scope", () => {
      const { filePath, source } = loadFixture("multiple-same-scope");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(3);

      const astPaths = analysis.definitions.map((d) => d.astPath).sort();
      expect(astPaths).toEqual(["container.model1", "container.model2", "container.model3"]);
    });
  });
});
