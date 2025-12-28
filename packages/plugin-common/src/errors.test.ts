import { describe, expect, test } from "vitest";
import type { CanonicalId } from "@soda-gql/common";
import {
  formatPluginError,
  isPluginError,
  type PluginAnalysisArtifactMissingError,
  type PluginAnalysisMetadataMissingError,
  type PluginAnalysisUnsupportedArtifactTypeError,
  type PluginBuilderCircularDependencyError,
  type PluginBuilderDocDuplicateError,
  type PluginBuilderEntryNotFoundError,
  type PluginBuilderModuleEvaluationFailedError,
  type PluginBuilderUnexpectedError,
  type PluginBuilderWriteFailedError,
  type PluginOptionsInvalidBuilderConfigError,
} from "./errors";

describe("Plugin Error Types", () => {
  describe("formatPluginError", () => {
    test("formats metadata missing error", () => {
      const error: PluginAnalysisMetadataMissingError = {
        type: "PluginError",
        stage: "analysis",
        code: "SODA_GQL_METADATA_NOT_FOUND",
        message: "No GraphQL metadata found for /test/file.ts",
        cause: { filename: "/test/file.ts" },
        filename: "/test/file.ts",
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("SODA_GQL_METADATA_NOT_FOUND");
      expect(formatted).toContain("analysis");
      expect(formatted).toContain("No GraphQL metadata found");
    });

    test("formats artifact missing error", () => {
      const canonicalId: CanonicalId = "/test/file.ts::userQuery" as CanonicalId;
      const error: PluginAnalysisArtifactMissingError = {
        type: "PluginError",
        stage: "analysis",
        code: "SODA_GQL_ANALYSIS_ARTIFACT_NOT_FOUND",
        message: `No builder artifact found for canonical ID ${canonicalId}`,
        cause: { filename: "/test/file.ts", canonicalId },
        filename: "/test/file.ts",
        canonicalId,
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("SODA_GQL_ANALYSIS_ARTIFACT_NOT_FOUND");
      expect(formatted).toContain("analysis");
      expect(formatted).toContain("userQuery");
    });

    test("formats unsupported artifact type error", () => {
      const canonicalId: CanonicalId = "/test/file.ts::unknown" as CanonicalId;
      const error: PluginAnalysisUnsupportedArtifactTypeError = {
        type: "PluginError",
        stage: "analysis",
        code: "SODA_GQL_UNSUPPORTED_ARTIFACT_TYPE",
        message: 'Unsupported builder artifact type "unknownType"',
        cause: {
          filename: "/test/file.ts",
          canonicalId,
          artifactType: "unknownType",
        },
        filename: "/test/file.ts",
        canonicalId,
        artifactType: "unknownType",
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("SODA_GQL_UNSUPPORTED_ARTIFACT_TYPE");
      expect(formatted).toContain("unknownType");
    });

    test("formats builder entry not found error", () => {
      const error: PluginBuilderEntryNotFoundError = {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_ENTRY_NOT_FOUND",
        message: "Entry not found",
        cause: {
          code: "ENTRY_NOT_FOUND",
          message: "Entry not found",
          entry: "/test/entry.ts",
        },
        entry: "/test/entry.ts",
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("SODA_GQL_BUILDER_ENTRY_NOT_FOUND");
      expect(formatted).toContain("builder");
    });

    test("formats builder doc duplicate error", () => {
      const error: PluginBuilderDocDuplicateError = {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_DOC_DUPLICATE",
        message: "Duplicate document",
        cause: {
          code: "DOC_DUPLICATE",
          message: "Duplicate document",
          name: "GetUser",
          sources: ["/test/file1.ts", "/test/file2.ts"],
        },
        name: "GetUser",
        sources: ["/test/file1.ts", "/test/file2.ts"],
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("SODA_GQL_BUILDER_DOC_DUPLICATE");
      expect(formatted).toContain("Duplicate document");
    });

    test("formats builder circular dependency error", () => {
      const error: PluginBuilderCircularDependencyError = {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_CIRCULAR_DEPENDENCY",
        message: "Circular dependency detected",
        cause: {
          code: "GRAPH_CIRCULAR_DEPENDENCY",
          message: "Circular dependency",
          chain: ["A", "B", "C", "A"],
        },
        chain: ["A", "B", "C", "A"],
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("SODA_GQL_BUILDER_CIRCULAR_DEPENDENCY");
      expect(formatted).toContain("Circular dependency");
    });

    test("formats builder module evaluation failed error", () => {
      const error: PluginBuilderModuleEvaluationFailedError = {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_MODULE_EVALUATION_FAILED",
        message: "Module evaluation failed",
        cause: {
          code: "RUNTIME_MODULE_LOAD_FAILED",
          message: "Failed to load module",
          filePath: "/test/file.ts",
          astPath: "userQuery",
          cause: new Error("Import error"),
        },
        filePath: "/test/file.ts",
        astPath: "userQuery",
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("SODA_GQL_BUILDER_MODULE_EVALUATION_FAILED");
      expect(formatted).toContain("Module evaluation failed");
    });

    test("formats builder write failed error", () => {
      const error: PluginBuilderWriteFailedError = {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_WRITE_FAILED",
        message: "Write failed",
        cause: {
          code: "WRITE_FAILED",
          message: "Failed to write",
          outPath: "/test/output.json",
          cause: new Error("Disk full"),
        },
        outPath: "/test/output.json",
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("SODA_GQL_BUILDER_WRITE_FAILED");
      expect(formatted).toContain("Write failed");
    });

    test("formats builder unexpected error", () => {
      const error: PluginBuilderUnexpectedError = {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_UNEXPECTED",
        message: "Unexpected error",
        cause: new Error("Something went wrong"),
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("SODA_GQL_BUILDER_UNEXPECTED");
      expect(formatted).toContain("Unexpected error");
    });

    test("formats options invalid builder config error", () => {
      const error: PluginOptionsInvalidBuilderConfigError = {
        type: "PluginError",
        stage: "normalize-options",
        code: "OPTIONS_INVALID_BUILDER_CONFIG",
        message: "Invalid builder configuration",
        cause: {
          code: "INVALID_BUILDER_CONFIG",
          message: "Invalid config",
        },
      };

      const formatted = formatPluginError(error);

      expect(formatted).toContain("OPTIONS_INVALID_BUILDER_CONFIG");
      expect(formatted).toContain("normalize-options");
    });
  });

  describe("isPluginError", () => {
    test("returns true for valid PluginError", () => {
      const error: PluginAnalysisMetadataMissingError = {
        type: "PluginError",
        stage: "analysis",
        code: "SODA_GQL_METADATA_NOT_FOUND",
        message: "Metadata not found",
        cause: { filename: "/test.ts" },
        filename: "/test.ts",
      };

      expect(isPluginError(error)).toBe(true);
    });

    test("returns false for non-PluginError objects", () => {
      expect(isPluginError(new Error("Regular error"))).toBe(false);
      expect(isPluginError({ message: "Not a plugin error" })).toBe(false);
      expect(isPluginError(null)).toBe(false);
      expect(isPluginError(undefined)).toBe(false);
      expect(isPluginError("string")).toBe(false);
      expect(isPluginError(123)).toBe(false);
    });

    test("returns false for objects with incorrect structure", () => {
      expect(
        isPluginError({
          type: "PluginError",
          code: "TEST",
          // missing message
        }),
      ).toBe(false);

      expect(
        isPluginError({
          type: "NotPluginError",
          code: "TEST",
          message: "Test",
        }),
      ).toBe(false);
    });
  });

  describe("Error structure validation", () => {
    test("analysis errors have required fields", () => {
      const metadataError: PluginAnalysisMetadataMissingError = {
        type: "PluginError",
        stage: "analysis",
        code: "SODA_GQL_METADATA_NOT_FOUND",
        message: "Test",
        cause: { filename: "/test.ts" },
        filename: "/test.ts",
      };

      expect(metadataError.type).toBe("PluginError");
      expect(metadataError.stage).toBe("analysis");
      expect(metadataError.filename).toBeDefined();
    });

    test("builder errors have required fields", () => {
      const builderError: PluginBuilderEntryNotFoundError = {
        type: "PluginError",
        stage: "builder",
        code: "SODA_GQL_BUILDER_ENTRY_NOT_FOUND",
        message: "Test",
        cause: {
          code: "ENTRY_NOT_FOUND",
          message: "Test",
          entry: "/test.ts",
        },
        entry: "/test.ts",
      };

      expect(builderError.type).toBe("PluginError");
      expect(builderError.stage).toBe("builder");
      expect(builderError.entry).toBeDefined();
    });
  });
});
