/**
 * Test cases for transformer conformance testing.
 *
 * This module exports test cases that define the expected transformation behavior.
 * Other plugins (like babel-plugin) can import these test cases to verify their
 * implementation produces the same output as tsc-transformer.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import * as ts from "typescript";
import { createTransformer } from "../../src/transformer";

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
};

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
 */
export const normalizeCode = async (code: string): Promise<string> => {
  // Dynamic import to avoid bundling prettier
  const prettier = await import("prettier");
  return prettier.format(code, {
    parser: "babel",
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
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
}: {
  readonly id: string;
  readonly description: string;
  readonly input: TransformTestInput;
  readonly config: ResolvedSodaGqlConfig;
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
  };
};
