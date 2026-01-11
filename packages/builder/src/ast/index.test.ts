import { describe, expect, it, test } from "bun:test";
import { getTestConfig } from "../../test/fixture-catalog/get-config";
import { fixtures, loadCoreInvalidFixture, loadModuleAnalysisFixture } from "../../test/utils/fixtures";
import { createGraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import { createAstAnalyzer } from ".";

const testConfig = getTestConfig();
const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);

const createAnalyzer = (type: "ts" | "swc") => createAstAnalyzer({ analyzer: type, graphqlHelper }).analyze;

const analyzeWithTS = createAnalyzer("ts");
const analyzeWithSWC = createAnalyzer("swc");

function expectDefinition<T>(array: readonly T[], index: number): T {
  const value = array[index];
  if (value === undefined) {
    throw new Error(`Missing definition at index ${index}`);
  }
  return value;
}

describe("AST Analyzer", () => {
  describe("TypeScript and SWC conformance", () => {
    test.each(fixtures.map((name) => [name]))("produces consistent astPath for: %s", (fixtureName) => {
      const { filePath, source } = loadModuleAnalysisFixture(fixtureName);
      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions.length).toBe(swcAnalysis.definitions.length);

      for (let i = 0; i < tsAnalysis.definitions.length; i++) {
        expect(tsAnalysis.definitions[i]?.astPath).toBe(swcAnalysis.definitions[i]?.astPath);
      }
    });
  });

  describe("Canonical path consistency", () => {
    it("generates same astPath for top-level definitions", () => {
      const { filePath, source } = loadModuleAnalysisFixture("top-level-simple");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      const tsDef = expectDefinition(tsAnalysis.definitions, 0);
      const swcDef = expectDefinition(swcAnalysis.definitions, 0);
      expect(tsDef.astPath).toBe(swcDef.astPath);
      expect(tsDef.astPath).toBe("userFragment");
    });

    it("generates same astPath for nested definitions in functions", () => {
      const { filePath, source } = loadModuleAnalysisFixture("nested-in-function");

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
      const { filePath, source } = loadModuleAnalysisFixture("arrow-function");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      const tsDef = expectDefinition(tsAnalysis.definitions, 0);
      const swcDef = expectDefinition(swcAnalysis.definitions, 0);
      expect(tsDef.astPath).toBe(swcDef.astPath);
      expect(tsDef.astPath).toMatch(/^factory\._arrow_\d+\.fragment$/);
    });

    it("generates same astPath for class method definitions", () => {
      const { filePath, source } = loadModuleAnalysisFixture("class-method");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      const tsDef = expectDefinition(tsAnalysis.definitions, 0);
      const swcDef = expectDefinition(swcAnalysis.definitions, 0);
      expect(tsDef.astPath).toBe(swcDef.astPath);
      expect(tsDef.astPath).toBe("UserRepository.getFragments.fragment");
    });

    it("generates same astPath for object property definitions", () => {
      const { filePath, source } = loadModuleAnalysisFixture("object-property");

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
      const { filePath, source } = loadModuleAnalysisFixture("duplicate-names");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(4);
      expect(swcAnalysis.definitions).toHaveLength(4);

      for (let i = 0; i < 4; i++) {
        const tsDef = expectDefinition(tsAnalysis.definitions, i);
        const swcDef = expectDefinition(swcAnalysis.definitions, i);
        expect(tsDef.astPath).toBe(swcDef.astPath);
      }

      expect(tsAnalysis.definitions[0]?.astPath).toBe("fragment1");
      expect(tsAnalysis.definitions[1]?.astPath).toBe("fragment2");
      expect(tsAnalysis.definitions[2]?.astPath).toBe("factory.fragment1");
      expect(tsAnalysis.definitions[3]?.astPath).toBe("factory.fragment2");
    });
  });

  describe("Export binding detection", () => {
    it("detects exported definitions", () => {
      const { filePath, source } = loadModuleAnalysisFixture("exported-and-private");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(2);

      const userFragment = analysis.definitions.find((d) => d.astPath === "userFragment");
      const privateFragment = analysis.definitions.find((d) => d.astPath === "privateFragment");

      expect(userFragment?.isExported).toBe(true);
      expect(userFragment?.exportBinding).toBe("userFragment");

      expect(privateFragment?.isExported).toBe(false);
      expect(privateFragment?.exportBinding).toBeUndefined();
    });

    it("detects exported function declarations", () => {
      const { filePath, source } = loadModuleAnalysisFixture("exported-function");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(1);
      expect(analysis.definitions[0]?.astPath).toBe("getFragment.fragment");
      expect(analysis.definitions[0]?.isTopLevel).toBe(false);
    });
  });

  describe("Complex nesting scenarios", () => {
    it("handles deeply nested definitions", () => {
      const { filePath, source } = loadModuleAnalysisFixture("deeply-nested");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);
      expect(tsAnalysis.definitions[0]?.astPath).toBe("Outer.method.obj.nested.deep");
      expect(swcAnalysis.definitions[0]?.astPath).toBe("Outer.method.obj.nested.deep");
    });

    it("handles multiple definitions in same scope", () => {
      const { filePath, source } = loadModuleAnalysisFixture("multiple-same-scope");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(3);

      const astPaths = analysis.definitions.map((d) => d.astPath).sort();
      expect(astPaths).toEqual(["container.fragment1", "container.fragment2", "container.fragment3"]);
    });
  });

  describe("TypeScript-specific features", () => {
    it("extracts top-level gql definitions with schema metadata", () => {
      const { filePath, source } = loadModuleAnalysisFixture("top-level-with-metadata");

      const analysis = analyzeWithTS({ filePath, source });

      const summary = analysis.definitions.map((definition) => ({
        astPath: definition.astPath,
      }));

      expect(summary).toEqual([{ astPath: "userFragment" }, { astPath: "pageQuery" }]);
    });

    it("collects gql definitions nested inside non-top-level scopes", () => {
      const { filePath, source } = loadCoreInvalidFixture("nested-non-top-level/source");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(1);
      const [definition] = analysis.definitions;
      expect(definition).toBeDefined();
      expect(definition?.astPath).toBe("buildOperation._arrow_0.invalid");
      expect(definition?.isTopLevel).toBe(false);
      expect(definition?.isExported).toBe(false);
      expect(definition?.exportBinding).toBeUndefined();
    });

    it("captures references to imported slices and models", () => {
      const { filePath, source } = loadModuleAnalysisFixture("imported-slice-refs");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(1);
      const [pageQuery] = analysis.definitions;
      expect(pageQuery).toBeDefined();
      expect(pageQuery?.astPath).toBe("pageQuery");
    });

    it("captures nested dependencies for slices", () => {
      const { filePath, source } = loadModuleAnalysisFixture("nested-namespace-deps");

      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.definitions).toHaveLength(1);
      const [pageQuery] = analysis.definitions;
      expect(pageQuery).toBeDefined();
      expect(pageQuery?.astPath).toBe("pageQuery");
    });

    it("captures both local and imported dependencies", () => {
      const { filePath, source } = loadModuleAnalysisFixture("local-and-imported-deps");

      const analysis = analyzeWithTS({ filePath, source });

      const pageQuery = analysis.definitions.find((def) => def.astPath === "pageQuery");
      expect(pageQuery?.astPath).toBe("pageQuery");
    });

    it("extracts definitions from multiple schemas", () => {
      const { filePath, source } = loadModuleAnalysisFixture("multiple-schemas");

      const analysis = analyzeWithTS({ filePath, source });

      const summary = analysis.definitions.map((definition) => ({
        astPath: definition.astPath,
      }));

      expect(summary).toEqual([{ astPath: "adminFragment" }, { astPath: "defaultQuery" }]);
    });
  });

  describe("Method chaining transparency", () => {
    it("detects gql definition through .attach() chain", () => {
      const { filePath, source } = loadModuleAnalysisFixture("attach-chaining");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      // Should detect all three definitions
      expect(tsAnalysis.definitions).toHaveLength(3);
      expect(swcAnalysis.definitions).toHaveLength(3);

      // Both analyzers should produce consistent results
      for (let i = 0; i < tsAnalysis.definitions.length; i++) {
        expect(tsAnalysis.definitions[i]?.astPath).toBe(swcAnalysis.definitions[i]?.astPath);
      }
    });

    it("extracts only base gql expression without .attach() chain", () => {
      const { filePath, source } = loadModuleAnalysisFixture("attach-chaining");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      for (const analysis of [tsAnalysis, swcAnalysis]) {
        for (const def of analysis.definitions) {
          // Expression should NOT contain .attach()
          expect(def.expression).not.toContain(".attach");
          // Expression should contain gql call
          expect(def.expression).toContain("gql");
        }
      }
    });

    it("handles multiple .attach() chains correctly", () => {
      const { filePath, source } = loadModuleAnalysisFixture("attach-chaining");

      const analysis = analyzeWithTS({ filePath, source });

      const multipleAttach = analysis.definitions.find((d) => d.astPath === "multipleAttach");

      // Expression should NOT contain any .attach()
      expect(multipleAttach?.expression).not.toContain(".attach");
      // Should contain the fragment definition
      expect(multipleAttach?.expression).toContain("fragment.User");
    });

    it("correctly identifies astPath for attach-chained definitions", () => {
      const { filePath, source } = loadModuleAnalysisFixture("attach-chaining");

      const analysis = analyzeWithTS({ filePath, source });

      const astPaths = analysis.definitions.map((d) => d.astPath).sort();
      expect(astPaths).toEqual(["multipleAttach", "operationAttach", "simpleAttach"]);
    });
  });

  describe("SWC analyzer patterns", () => {
    it("extracts top-level definitions", () => {
      const { filePath, source } = loadModuleAnalysisFixture("top-level-definitions");

      const analysis = analyzeWithSWC({ filePath, source });
      const names = analysis.definitions.map((item) => item.astPath);
      expect(names).toContain("pageQuery");
    });

    it("extracts definitions from object property exports", () => {
      const { filePath, source } = loadModuleAnalysisFixture("object-property-exports");

      const analysis = analyzeWithSWC({ filePath, source });
      const names = analysis.definitions.map((item) => item.astPath);
      expect(names).toContain("user_remoteFragment.forIterate");
    });

    it("collects nested definitions inside functions", () => {
      const { filePath, source } = loadModuleAnalysisFixture("nested-in-functions");

      const analysis = analyzeWithSWC({ filePath, source });
      expect(analysis.definitions).toHaveLength(1);
      const [definition] = analysis.definitions;
      expect(definition?.isTopLevel).toBe(false);
      expect(definition?.isExported).toBe(false);
    });

    it("captures references to properties on imported bindings", () => {
      const { filePath, source } = loadModuleAnalysisFixture("imported-binding-refs");

      const analysis = analyzeWithSWC({ filePath, source });
      const definition = analysis.definitions.find((item) => item.astPath === "pageQuery");
      expect(definition?.astPath).toBe("pageQuery");
    });

    it("captures deep member references from namespace imports", () => {
      const { filePath, source } = loadModuleAnalysisFixture("namespace-imports");

      const analysis = analyzeWithSWC({ filePath, source });
      const definition = analysis.definitions.find((item) => item.astPath === "pageQuery");
      expect(definition?.astPath).toBe("pageQuery");
    });
  });

  describe("Anonymous/inline patterns", () => {
    it("generates astPath for gql call passed to function argument", () => {
      const { filePath, source } = loadModuleAnalysisFixture("anonymous-function-arg");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      const tsDef = expectDefinition(tsAnalysis.definitions, 0);
      const swcDef = expectDefinition(swcAnalysis.definitions, 0);
      expect(tsDef.astPath).toBe(swcDef.astPath);
      expect(tsDef.astPath).toMatch(/^_anonymous_\d+$/);
    });

    it("generates astPath for gql call in destructuring assignment", () => {
      const { filePath, source } = loadModuleAnalysisFixture("anonymous-destructure");

      const tsAnalysis = analyzeWithTS({ filePath, source });
      const swcAnalysis = analyzeWithSWC({ filePath, source });

      expect(tsAnalysis.definitions).toHaveLength(1);
      expect(swcAnalysis.definitions).toHaveLength(1);

      const tsDef = expectDefinition(tsAnalysis.definitions, 0);
      const swcDef = expectDefinition(swcAnalysis.definitions, 0);
      expect(tsDef.astPath).toBe(swcDef.astPath);
      expect(tsDef.astPath).toMatch(/^_anonymous_\d+$/);
    });
  });
});
