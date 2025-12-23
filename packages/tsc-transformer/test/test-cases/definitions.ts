/**
 * Test case definitions for tsc-transformer conformance testing.
 *
 * Each definition maps a fixture to its expected transformation behavior.
 */

export type TestCaseDefinition = {
  readonly id: string;
  readonly description: string;
  readonly fixtureName: string;
  readonly isMultiFile: boolean;
  readonly expectations: {
    /** Expected gqlRuntime.* calls in the output */
    readonly runtimeCalls: readonly string[];
    /** Whether the transformer should add @soda-gql/runtime import */
    readonly shouldAddRuntimeImport: boolean;
    /** Whether the source should be transformed at all */
    readonly shouldTransform: boolean;
  };
};

/**
 * Single-file test case definitions.
 */
const singleFileTestCases: TestCaseDefinition[] = [
  // Models
  {
    id: "models/basic",
    description: "Basic model definition transformation",
    fixtureName: "models/basic",
    isMultiFile: false,
    expectations: {
      runtimeCalls: ["gqlRuntime.model"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },

  // Slices
  {
    id: "slices/basic",
    description: "Basic slice definition transformation",
    fixtureName: "slices/basic",
    isMultiFile: false,
    expectations: {
      runtimeCalls: ["gqlRuntime.slice"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },

  // Operations
  {
    id: "operations/basic",
    description: "Basic operation definition transformation",
    fixtureName: "operations/basic",
    isMultiFile: false,
    expectations: {
      runtimeCalls: ["gqlRuntime.composedOperation"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },

  // Imports
  {
    id: "imports/add-runtime",
    description: "Add runtime import when not present",
    fixtureName: "imports/add-runtime",
    isMultiFile: false,
    expectations: {
      runtimeCalls: ["gqlRuntime.model"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
  {
    id: "imports/merge-runtime-import",
    description: "Merge with existing runtime import",
    fixtureName: "imports/merge-runtime-import",
    isMultiFile: false,
    expectations: {
      runtimeCalls: ["gqlRuntime.model"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
  {
    id: "imports/multiple-definitions",
    description: "Multiple gql definitions in one file",
    fixtureName: "imports/multiple-definitions",
    isMultiFile: false,
    expectations: {
      runtimeCalls: ["gqlRuntime.model"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
  {
    id: "imports/preserve-other-imports",
    description: "Preserve non-gql imports",
    fixtureName: "imports/preserve-other-imports",
    isMultiFile: false,
    expectations: {
      runtimeCalls: ["gqlRuntime.model"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },

  // Errors
  {
    id: "errors/no-gql-code",
    description: "Skip files without gql code",
    fixtureName: "errors/no-gql-code",
    isMultiFile: false,
    expectations: {
      runtimeCalls: [],
      shouldAddRuntimeImport: false,
      shouldTransform: false,
    },
  },
  {
    id: "errors/renamed-import",
    description: "Skip renamed imports (gql as g) - not recognized",
    fixtureName: "errors/renamed-import",
    isMultiFile: false,
    expectations: {
      runtimeCalls: [],
      shouldAddRuntimeImport: false,
      shouldTransform: false,
    },
  },
  {
    id: "errors/invalid-call-no-args",
    description: "Skip gql.default() with no arguments",
    fixtureName: "errors/invalid-call-no-args",
    isMultiFile: false,
    expectations: {
      runtimeCalls: [],
      shouldAddRuntimeImport: false,
      shouldTransform: false,
    },
  },
  {
    id: "errors/invalid-call-wrong-type",
    description: "Skip gql.default() with non-function argument",
    fixtureName: "errors/invalid-call-wrong-type",
    isMultiFile: false,
    expectations: {
      runtimeCalls: [],
      shouldAddRuntimeImport: false,
      shouldTransform: false,
    },
  },

  // Import edge cases
  {
    id: "imports/star-import",
    description: "Skip star import (import * as) - not supported by builder",
    fixtureName: "imports/star-import",
    isMultiFile: false,
    expectations: {
      runtimeCalls: [],
      shouldAddRuntimeImport: false,
      shouldTransform: false,
    },
  },

  // Scope edge cases
  {
    id: "scopes/deeply-nested",
    description: "Handle deeply nested scopes (4+ levels)",
    fixtureName: "scopes/deeply-nested",
    isMultiFile: false,
    expectations: {
      runtimeCalls: ["gqlRuntime.model"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
  {
    id: "scopes/duplicate-names",
    description: "Handle duplicate variable names in different scopes",
    fixtureName: "scopes/duplicate-names",
    isMultiFile: false,
    expectations: {
      runtimeCalls: ["gqlRuntime.model"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
  {
    id: "scopes/class-properties",
    description: "Skip class properties - scope tracking differs across transformers",
    fixtureName: "scopes/class-properties",
    isMultiFile: false,
    expectations: {
      runtimeCalls: [],
      shouldAddRuntimeImport: false,
      shouldTransform: false,
    },
  },
];

/**
 * Multi-file test case definitions.
 */
const multiFileTestCases: TestCaseDefinition[] = [
  {
    id: "models/multiple-files",
    description: "Multiple model files",
    fixtureName: "models/multiple-files",
    isMultiFile: true,
    expectations: {
      runtimeCalls: ["gqlRuntime.model"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
  {
    id: "slices/with-imported-models",
    description: "Slices importing models from other files",
    fixtureName: "slices/with-imported-models",
    isMultiFile: true,
    expectations: {
      runtimeCalls: ["gqlRuntime.model", "gqlRuntime.slice"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
  {
    id: "operations/composed-with-imported-slices",
    description: "Composed operations with imported slices",
    fixtureName: "operations/composed-with-imported-slices",
    isMultiFile: true,
    expectations: {
      runtimeCalls: ["gqlRuntime.slice", "gqlRuntime.composedOperation"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
  {
    id: "operations/inline-with-imported-models",
    description: "Inline operations with imported models",
    fixtureName: "operations/inline-with-imported-models",
    isMultiFile: true,
    expectations: {
      runtimeCalls: ["gqlRuntime.model", "gqlRuntime.inlineOperation"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
  {
    id: "mixed/full-app",
    description: "Full application with models, slices, and operations",
    fixtureName: "mixed/full-app",
    isMultiFile: true,
    expectations: {
      runtimeCalls: ["gqlRuntime.model", "gqlRuntime.slice", "gqlRuntime.composedOperation"],
      shouldAddRuntimeImport: true,
      shouldTransform: true,
    },
  },
];

/**
 * All test case definitions.
 */
export const testCaseDefinitions: readonly TestCaseDefinition[] = [...singleFileTestCases, ...multiFileTestCases];

/**
 * Get test case definitions filtered by single-file fixtures.
 */
export const getSingleFileTestCases = (): readonly TestCaseDefinition[] => {
  return testCaseDefinitions.filter((tc) => !tc.isMultiFile);
};

/**
 * Get test case definitions filtered by multi-file fixtures.
 */
export const getMultiFileTestCases = (): readonly TestCaseDefinition[] => {
  return testCaseDefinitions.filter((tc) => tc.isMultiFile);
};
