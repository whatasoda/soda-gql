/**
 * TypeScript transformer for soda-gql.
 *
 * This package provides the core transformation logic for converting
 * gql.default() calls to runtime calls. It is used by @soda-gql/tsc-plugin
 * and provides test cases for verifying other plugin implementations.
 */

export { createTransformer, createAfterStubTransformer } from "./transformer";
export type { TypeScriptEnv } from "./transformer";
