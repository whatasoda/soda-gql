/**
 * TypeScript transformer for soda-gql.
 *
 * This package provides the core transformation logic for converting
 * gql.default() calls to runtime calls.
 */

export type { TypeScriptEnv } from "./transformer";
export { createAfterStubTransformer, createTransformer } from "./transformer";
