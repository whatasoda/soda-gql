/**
 * TypeScript transformer for soda-gql.
 *
 * This package provides the core transformation logic for converting
 * gql.default() calls to runtime calls. It is used by @soda-gql/tsc-plugin
 * and provides test cases for verifying other plugin implementations.
 */

export type { TypeScriptEnv } from "./transformer";
export { createAfterStubTransformer, createTransformer } from "./transformer";
