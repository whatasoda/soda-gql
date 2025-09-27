import { expect } from "bun:test";
import { transformAsync } from "@babel/core";
import type { BuilderArtifact } from "../../packages/builder/src/index.ts";
import createPlugin from "../../packages/plugin-babel/src/index.ts";
import { TestTempDir } from "./index.ts";

export type TransformOptions = {
  mode?: "zero-runtime" | "runtime";
  importIdentifier?: string;
  artifactsPath?: string;
};

/**
 * Run Babel transform with the soda-gql plugin
 */
export const runBabelTransform = async (
  source: string,
  filename: string,
  artifact: BuilderArtifact,
  options: TransformOptions = {},
): Promise<string> => {
  const tempDir = new TestTempDir("babel-transform");

  try {
    const { mode = "zero-runtime", importIdentifier = "@soda-gql/runtime", artifactsPath } = options;

    const actualArtifactsPath = artifactsPath ?? tempDir.join("artifact.json");

    if (!artifactsPath) {
      await Bun.write(actualArtifactsPath, JSON.stringify(artifact));
    }

    const result = await transformAsync(source, {
      filename,
      configFile: false,
      babelrc: false,
      parserOpts: {
        sourceType: "module",
        plugins: ["typescript"],
      },
      plugins: [
        [
          createPlugin,
          {
            mode,
            artifactsPath: actualArtifactsPath,
            importIdentifier,
          },
        ],
      ],
    });

    return result?.code ?? "";
  } finally {
    tempDir.cleanup();
  }
};

/**
 * Assert that transform removes gql calls
 */
export const assertTransformRemovesGql = (transformed: string): void => {
  expect(transformed).not.toContain("gql.query(");
  expect(transformed).not.toContain("gql.model(");
  expect(transformed).not.toContain("gql.querySlice(");
  expect(transformed).not.toContain("gql.fragment(");
};

/**
 * Assert that transform adds runtime import
 */
export const assertTransformAddsRuntimeImport = (transformed: string, identifier = "@soda-gql/runtime"): void => {
  expect(transformed).toContain(`import { gqlRuntime } from "${identifier}"`);
};

/**
 * Assert that transform uses runtime calls
 */
export const assertTransformUsesRuntime = (transformed: string): void => {
  const hasRuntimeCall = /gqlRuntime\.(query|model|querySlice|fragment)\(/.test(transformed);
  expect(hasRuntimeCall).toBe(true);
};

/**
 * Assert complete zero-runtime transformation
 */
export const assertZeroRuntimeTransform = (transformed: string, importIdentifier = "@soda-gql/runtime"): void => {
  assertTransformRemovesGql(transformed);
  assertTransformAddsRuntimeImport(transformed, importIdentifier);
  assertTransformUsesRuntime(transformed);
};

/**
 * Assert that transform preserves imports
 */
export const assertTransformPreservesImports = (transformed: string, imports: string[]): void => {
  for (const importStr of imports) {
    expect(transformed).toContain(importStr);
  }
};

/**
 * Assert that transform contains specific runtime call
 */
export const assertTransformContainsRuntimeCall = (
  transformed: string,
  method: "query" | "model" | "querySlice" | "fragment",
  expectedArgs?: string,
): void => {
  const pattern = expectedArgs ? `gqlRuntime.${method}(${expectedArgs})` : `gqlRuntime.${method}(`;
  expect(transformed).toContain(pattern);
};

/**
 * Create a simple source code for testing transforms
 */
export const createTestSource = (content: string, imports = 'import { gql } from "@soda-gql/core";'): string => {
  return `${imports}

${content}`;
};

/**
 * Parse transformed code and extract runtime calls
 */
export const extractRuntimeCalls = (transformed: string): Array<{ method: string; args: string }> => {
  const calls: Array<{ method: string; args: string }> = [];
  const regex = /gqlRuntime\.(\w+)\(([\s\S]*?)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(transformed)) !== null) {
    calls.push({
      method: match[1],
      args: match[2].trim(),
    });
  }

  return calls;
};
