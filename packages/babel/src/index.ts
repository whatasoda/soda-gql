/**
 * Babel transformer for soda-gql.
 *
 * This package provides the core transformation logic for converting
 * gql.default() calls to runtime calls.
 *
 * Two interfaces are provided:
 * - `createTransformer`: AST-based, works with Babel's NodePath (used by plugin)
 * - `createBabelTransformer` / `transform`: Source-code based (similar to swc-transformer)
 */

// Re-export AST utilities for advanced use cases
export * from "./ast";
export type { Transformer, TransformInput, TransformOptions, TransformOutput } from "./transform";

// Source-code based transformer (for direct use, similar to swc-transformer)
export { createBabelTransformer, transform } from "./transform";
// AST-based transformer (for plugin integration)
export { createTransformer } from "./transformer";
export type { TransformPassResult, TransformProgramContext } from "./types";
