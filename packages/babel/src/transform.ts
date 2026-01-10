/**
 * Source-code based transform function for babel-transformer.
 *
 * This provides a similar interface to swc, taking source code
 * as input and returning transformed source code.
 */

import remapping from "@ampproject/remapping";
import { types as t } from "@babel/core";
import _generate from "@babel/generator";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import type { BuilderArtifact } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { createTransformer as createAstTransformer } from "./transformer";

// Handle default export compatibility for both ESM and CJS
const traverse = typeof _traverse === "function" ? _traverse : (_traverse as { default: typeof _traverse }).default;
const generate = typeof _generate === "function" ? _generate : (_generate as { default: typeof _generate }).default;

/**
 * Options for creating a transformer.
 */
export type TransformOptions = {
  /** Resolved soda-gql configuration */
  config: ResolvedSodaGqlConfig;
  /** Pre-built artifact from the builder */
  artifact: BuilderArtifact;
  /** Whether to generate source maps */
  sourceMap?: boolean;
};

/**
 * Input for the transform function.
 */
export type TransformInput = {
  /** Source code to transform */
  sourceCode: string;
  /** Path to the source file */
  sourcePath: string;
  /** Input source map from previous transformer (JSON string) */
  inputSourceMap?: string;
};

/**
 * Output from the transform function.
 */
export type TransformOutput = {
  /** Whether any transformation was performed */
  transformed: boolean;
  /** The transformed source code (or original if no transformation) */
  sourceCode: string;
  /** Source map JSON, if source map generation was enabled */
  sourceMap?: string;
};

/**
 * Transformer interface (matches swc).
 */
export interface Transformer {
  transform(input: TransformInput): TransformOutput;
}

/**
 * Create a transformer instance.
 *
 * @param options - Transform options including config and artifact
 * @returns A transformer that can transform source files
 */
export const createBabelTransformer = (options: TransformOptions): Transformer => {
  const { config, artifact, sourceMap = false } = options;

  return {
    transform: ({ sourceCode, sourcePath, inputSourceMap }: TransformInput): TransformOutput => {
      // Parse source code to AST
      const ast = parse(sourceCode, {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
        sourceFilename: sourcePath,
      });

      // Create a mock program path for the AST transformer
      let programPath: Parameters<typeof createAstTransformer>[0]["programPath"] | null = null;

      traverse(ast, {
        Program(path) {
          programPath = path;
          path.stop();
        },
      });

      if (!programPath) {
        return {
          transformed: false,
          sourceCode,
          sourceMap: undefined,
        };
      }

      // Create and run the AST transformer
      const transformer = createAstTransformer({
        programPath,
        types: t,
        config,
      });

      const result = transformer.transform({
        filename: sourcePath,
        artifactLookup: (canonicalId) => artifact.elements[canonicalId],
      });

      if (!result.transformed) {
        return {
          transformed: false,
          sourceCode,
          sourceMap: undefined,
        };
      }

      // Generate code from transformed AST
      const output = generate(
        ast,
        {
          sourceMaps: sourceMap,
          sourceFileName: sourcePath,
        },
        sourceCode,
      );

      // Handle source map chaining
      let finalSourceMap: string | undefined;
      if (sourceMap && output.map) {
        if (inputSourceMap) {
          // Chain source maps: our map -> input map -> original source
          const merged = remapping([output.map, JSON.parse(inputSourceMap)], () => null);
          finalSourceMap = JSON.stringify(merged);
        } else {
          finalSourceMap = JSON.stringify(output.map);
        }
      }

      return {
        transformed: true,
        sourceCode: output.code,
        sourceMap: finalSourceMap,
      };
    },
  };
};

/**
 * Transform a single source file (one-shot).
 *
 * For transforming multiple files, use createBabelTransformer() to reuse the artifact.
 *
 * @param input - Transform input including source, path, artifact, and config
 * @returns Transform output
 */
export const transform = (
  input: TransformInput & {
    artifact: BuilderArtifact;
    config: ResolvedSodaGqlConfig;
    sourceMap?: boolean;
  },
): TransformOutput => {
  const transformer = createBabelTransformer({
    config: input.config,
    artifact: input.artifact,
    sourceMap: input.sourceMap,
  });

  return transformer.transform({
    sourceCode: input.sourceCode,
    sourcePath: input.sourcePath,
    inputSourceMap: input.inputSourceMap,
  });
};
