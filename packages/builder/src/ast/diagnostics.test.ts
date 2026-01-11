import { describe, expect, test } from "bun:test";
import { getTestConfig } from "../../test/fixture-catalog/get-config";
import { invalidFixtures, loadCoreInvalidFixture } from "../../test/utils/fixtures";
import { createGraphqlSystemIdentifyHelper } from "../internal/graphql-system";
import { createAstAnalyzer } from ".";
import type { DiagnosticCode } from "./types";

const testConfig = getTestConfig();
const graphqlHelper = createGraphqlSystemIdentifyHelper(testConfig);

const createAnalyzer = (type: "ts" | "swc") => createAstAnalyzer({ analyzer: type, graphqlHelper }).analyze;

const analyzeWithTS = createAnalyzer("ts");
const analyzeWithSWC = createAnalyzer("swc");

/**
 * Expected diagnostics for each invalid fixture.
 * Format: { code, count? } where count defaults to 1
 */
type ExpectedDiagnostic = {
  readonly code: DiagnosticCode;
  readonly count?: number;
};

const diagnosticExpectations: Record<string, ExpectedDiagnostic[]> = {
  // Import-level issues
  "renamed-import/source": [{ code: "RENAMED_IMPORT" }],
  "star-import/source": [{ code: "STAR_IMPORT" }],
  "default-import/source": [{ code: "DEFAULT_IMPORT" }],

  // Call-level issues
  "invalid-call-no-args/source": [{ code: "MISSING_ARGUMENT" }],
  "invalid-call-wrong-type/source": [{ code: "INVALID_ARGUMENT_TYPE" }],
  "non-member-callee/source": [{ code: "NON_MEMBER_CALLEE" }],
  "computed-property/source": [{ code: "COMPUTED_PROPERTY", count: 2 }],
  "dynamic-callee/source": [{ code: "DYNAMIC_CALLEE", count: 2 }],

  // Scope-level issues
  "class-properties/source": [{ code: "CLASS_PROPERTY", count: 2 }],

  // Not an error - just no gql code
  "no-gql-code/source": [],
};

describe("Analyzer Diagnostics", () => {
  describe("TypeScript adapter", () => {
    test.each(Object.entries(diagnosticExpectations))(
      "detects expected diagnostics for: %s",
      (fixtureName, expectedDiagnostics) => {
        const { filePath, source } = loadCoreInvalidFixture(fixtureName);
        const analysis = analyzeWithTS({ filePath, source });

        // Check each expected diagnostic
        for (const expected of expectedDiagnostics) {
          const matches = analysis.diagnostics.filter((d) => d.code === expected.code);
          const expectedCount = expected.count ?? 1;
          expect(matches.length).toBe(expectedCount);
        }

        // Verify total count matches
        const totalExpected = expectedDiagnostics.reduce((sum, e) => sum + (e.count ?? 1), 0);
        expect(analysis.diagnostics.length).toBe(totalExpected);
      },
    );
  });

  describe("SWC adapter conformance", () => {
    test.each(Object.entries(diagnosticExpectations))(
      "produces consistent diagnostics for: %s",
      (fixtureName, _expectedDiagnostics) => {
        const { filePath, source } = loadCoreInvalidFixture(fixtureName);
        const tsAnalysis = analyzeWithTS({ filePath, source });
        const swcAnalysis = analyzeWithSWC({ filePath, source });

        // Same number of diagnostics
        expect(swcAnalysis.diagnostics.length).toBe(tsAnalysis.diagnostics.length);

        // Same diagnostic codes in same order
        for (let i = 0; i < tsAnalysis.diagnostics.length; i++) {
          expect(swcAnalysis.diagnostics[i]?.code).toBe(tsAnalysis.diagnostics[i]?.code);
        }
      },
    );
  });

  describe("All invalid fixtures covered", () => {
    test("diagnosticExpectations covers all invalid fixtures", () => {
      const coveredFixtures = Object.keys(diagnosticExpectations);
      const allInvalidFixtures = [...invalidFixtures];

      // Check that all invalid fixtures have expectations defined
      for (const fixture of allInvalidFixtures) {
        expect(coveredFixtures).toContain(fixture);
      }
    });
  });

  describe("Diagnostic properties", () => {
    test("RENAMED_IMPORT includes context with importedAs", () => {
      const { filePath, source } = loadCoreInvalidFixture("renamed-import/source");
      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.diagnostics).toHaveLength(1);
      const [diagnostic] = analysis.diagnostics;
      expect(diagnostic?.code).toBe("RENAMED_IMPORT");
      expect(diagnostic?.context?.importedAs).toBe("g");
      expect(diagnostic?.severity).toBe("warning");
    });

    test("STAR_IMPORT includes context with namespaceAlias", () => {
      const { filePath, source } = loadCoreInvalidFixture("star-import/source");
      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.diagnostics).toHaveLength(1);
      const [diagnostic] = analysis.diagnostics;
      expect(diagnostic?.code).toBe("STAR_IMPORT");
      expect(diagnostic?.context?.namespaceAlias).toBe("gqlSystem");
      expect(diagnostic?.severity).toBe("warning");
    });

    test("INVALID_ARGUMENT_TYPE includes context with actualType", () => {
      const { filePath, source } = loadCoreInvalidFixture("invalid-call-wrong-type/source");
      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.diagnostics).toHaveLength(1);
      const [diagnostic] = analysis.diagnostics;
      expect(diagnostic?.code).toBe("INVALID_ARGUMENT_TYPE");
      expect(diagnostic?.context?.actualType).toBe("string");
      expect(diagnostic?.severity).toBe("error");
    });

    test("MISSING_ARGUMENT has error severity", () => {
      const { filePath, source } = loadCoreInvalidFixture("invalid-call-no-args/source");
      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.diagnostics).toHaveLength(1);
      const [diagnostic] = analysis.diagnostics;
      expect(diagnostic?.code).toBe("MISSING_ARGUMENT");
      expect(diagnostic?.severity).toBe("error");
    });

    test("diagnostics have valid location info", () => {
      const { filePath, source } = loadCoreInvalidFixture("renamed-import/source");
      const analysis = analyzeWithTS({ filePath, source });

      expect(analysis.diagnostics).toHaveLength(1);
      const [diagnostic] = analysis.diagnostics;
      expect(diagnostic?.location.start).toBeGreaterThanOrEqual(0);
      expect(diagnostic?.location.end).toBeGreaterThan(diagnostic?.location.start ?? 0);
    });
  });
});
