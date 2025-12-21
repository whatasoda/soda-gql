/**
 * Test cases for transformer conformance testing.
 *
 * This module exports test cases that define the expected transformation behavior.
 * Other plugins (like babel-plugin) can import these test cases to verify their
 * implementation produces the same output as tsc-transformer.
 */

import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import * as ts from "typescript";
import { createTransformer } from "../../src/transformer";
import { getSingleFileTestCases, type TestCaseDefinition } from "./definitions";
import { createTestConfig, loadPluginFixture } from "./utils";

export type ModuleFormat = "esm" | "cjs";

/**
 * Input for a transformation test case.
 */
export type TransformTestInput = {
  /** Source code to transform */
  readonly sourceCode: string;
  /** Source file path */
  readonly sourcePath: string;
  /** Pre-built artifact from the builder */
  readonly artifact: BuilderArtifact;
};

/**
 * A single transformation test case with input and expected outputs.
 */
export type TransformTestCase = {
  /** Unique identifier for the test case */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Input for transformation */
  readonly input: TransformTestInput;
  /** Expected outputs for each module format (Prettier normalized) */
  readonly expected: {
    readonly esm: string;
    readonly cjs: string;
  };
  /** Test expectations for validation */
  readonly expectations: TestCaseDefinition["expectations"];
};

// Re-export types and utilities
export type { TestCaseDefinition } from "./definitions";
export { getMultiFileTestCases, getSingleFileTestCases, testCaseDefinitions } from "./definitions";
export { createTestConfig, loadPluginFixture, loadPluginFixtureMulti } from "./utils";

/**
 * Transform source code using tsc-transformer.
 * This is the reference implementation that babel-plugin should match.
 */
export const transformWithTsc = async ({
  sourceCode,
  sourcePath,
  artifact,
  config,
  moduleFormat,
}: {
  readonly sourceCode: string;
  readonly sourcePath: string;
  readonly artifact: BuilderArtifact;
  readonly config: ResolvedSodaGqlConfig;
  readonly moduleFormat: ModuleFormat;
}): Promise<string> => {
  const compilerOptions: ts.CompilerOptions = {
    module: moduleFormat === "esm" ? ts.ModuleKind.ES2015 : ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
    skipLibCheck: true,
  };

  const transformer = createTransformer({ compilerOptions, config, artifact });

  const transformerFactory: ts.TransformerFactory<ts.SourceFile> = (context) => {
    return (sourceFile) => {
      const result = transformer.transform({ sourceFile, context });
      return result.sourceFile;
    };
  };

  const result = ts.transpileModule(sourceCode, {
    fileName: sourcePath,
    compilerOptions,
    transformers: {
      before: [transformerFactory],
    },
  });

  return result.outputText;
};

/**
 * Normalize code output for comparison using Prettier.
 * This removes formatting differences between transformers.
 *
 * Note: Some differences between babel and tsc output are unavoidable:
 * - CJS export patterns differ (TypeScript uses direct assignment, Babel uses const with assignment)
 * - Object property formatting may differ based on content length
 *
 * For true semantic comparison, use runtime behavior testing instead of string comparison.
 */
export const normalizeCode = async (code: string): Promise<string> => {
  // Dynamic import to avoid bundling prettier
  const prettier = await import("prettier");
  return prettier.format(code, {
    parser: "babel",
    // Use very short printWidth to force all objects to expand consistently
    printWidth: 40,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    // Force consistent trailing commas
    trailingComma: "all",
  });
};

/**
 * Generate a test case from a loaded fixture.
 * This runs tsc-transformer to produce the expected output.
 */
export const generateTestCase = async ({
  id,
  description,
  input,
  config,
  expectations = { runtimeCalls: [], shouldAddRuntimeImport: false, shouldTransform: true },
}: {
  readonly id: string;
  readonly description: string;
  readonly input: TransformTestInput;
  readonly config: ResolvedSodaGqlConfig;
  readonly expectations?: TestCaseDefinition["expectations"];
}): Promise<TransformTestCase> => {
  const esmOutput = await transformWithTsc({
    sourceCode: input.sourceCode,
    sourcePath: input.sourcePath,
    artifact: input.artifact,
    config,
    moduleFormat: "esm",
  });

  const cjsOutput = await transformWithTsc({
    sourceCode: input.sourceCode,
    sourcePath: input.sourcePath,
    artifact: input.artifact,
    config,
    moduleFormat: "cjs",
  });

  return {
    id,
    description,
    input,
    expected: {
      esm: await normalizeCode(esmOutput),
      cjs: await normalizeCode(cjsOutput),
    },
    expectations,
  };
};

/**
 * Create a config for transformation using the shared codegen-fixture.
 * Uses the pre-generated graphql-system from fixture:setup.
 */
const createTransformConfig = (): ResolvedSodaGqlConfig => {
  return createTestConfig();
};

/**
 * Load all single-file test cases with dynamically generated expected outputs.
 *
 * This is the main entry point for conformance testing. The returned test cases
 * are verified by tsc-transformer's own tests, ensuring the expected outputs
 * are correct.
 *
 * @returns Array of test cases with input, expected output, and expectations
 */
export const loadTestCases = async (): Promise<TransformTestCase[]> => {
  const definitions = getSingleFileTestCases();
  const testCases: TransformTestCase[] = [];
  const config = createTransformConfig();

  for (const definition of definitions) {
    const fixture = await loadPluginFixture(definition.fixtureName);

    const testCase = await generateTestCase({
      id: definition.id,
      description: definition.description,
      input: {
        sourceCode: fixture.sourceCode,
        sourcePath: fixture.sourcePath,
        artifact: fixture.artifact,
      },
      config,
      expectations: definition.expectations,
    });

    testCases.push(testCase);
  }

  return testCases;
};
