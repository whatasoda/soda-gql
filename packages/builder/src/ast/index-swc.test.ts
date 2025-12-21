import { describe, expect, it } from "bun:test";
import { getTestConfig } from "../../test/codegen-fixture/get-config";
import { loadModuleAnalysisFixture } from "../../test/utils/fixtures";
import { createGraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import { createAstAnalyzer } from ".";

const testConfig = getTestConfig();
const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);
const analyzeModule = createAstAnalyzer({
  analyzer: "swc",
  graphqlHelper,
}).analyze;

const loadFixture = (name: string) => loadModuleAnalysisFixture("swc", name);

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
  });

  it("collects nested definitions inside functions", () => {
    const { filePath, source } = loadFixture("nested-in-functions");

    const analysis = analyzeModule({ filePath, source });
    expect(analysis.definitions).toHaveLength(1);
    const [definition] = analysis.definitions;
    expect(definition?.isTopLevel).toBe(false);
    expect(definition?.isExported).toBe(false);
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
