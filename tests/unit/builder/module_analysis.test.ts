import { describe, expect, it } from "bun:test";
import { createAstAnalyzer } from "@soda-gql/builder/ast";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder/internal/graphql-system";
import { createTestConfig } from "../../helpers/test-config";
import { loadModuleAnalysisFixture } from "../../utils";

const testConfig = createTestConfig("/test");
const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
const analyzeModule = createAstAnalyzer({ analyzer: "ts", graphqlHelper }).analyze;

const loadFixture = (name: string) => loadModuleAnalysisFixture("ts", name);

describe("Module analyzer - TypeScript", () => {
  it("extracts top-level gql definitions with schema metadata", () => {
    const { filePath, source } = loadFixture("top-level-with-metadata");

    const analysis = analyzeModule({ filePath, source });

    const summary = analysis.definitions.map((definition) => ({
      astPath: definition.astPath,
    }));

    expect(summary).toEqual([{ astPath: "userModel" }, { astPath: "userSlice" }, { astPath: "pageQuery" }]);
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
    expect(pageQuery?.astPath).toBe("pageQuery");
  });

  it("captures nested dependencies for slices", () => {
    const { filePath, source } = loadFixture("nested-namespace-deps");

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toHaveLength(1);
    const [pageQuery] = analysis.definitions;
    expect(pageQuery).toBeDefined();
    expect(pageQuery?.astPath).toBe("pageQuery");
  });

  it("captures references in nested object values", () => {
    const { filePath, source } = loadFixture("nested-object-values");

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toHaveLength(1);
    const [complexQuery] = analysis.definitions;
    expect(complexQuery).toBeDefined();
    expect(complexQuery?.astPath).toBe("complexQuery");
  });

  it("captures both local and imported dependencies", () => {
    const { filePath, source } = loadFixture("local-and-imported-deps");

    const analysis = analyzeModule({ filePath, source });

    const pageQuery = analysis.definitions.find((def) => def.astPath === "pageQuery");
    expect(pageQuery?.astPath).toBe("pageQuery");
  });

  it("extracts definitions from multiple schemas", () => {
    const { filePath, source } = loadFixture("multiple-schemas");

    const analysis = analyzeModule({ filePath, source });

    const summary = analysis.definitions.map((definition) => ({
      astPath: definition.astPath,
    }));

    expect(summary).toEqual([{ astPath: "adminModel" }, { astPath: "defaultQuery" }]);
  });
});
