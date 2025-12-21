/**
 * TypeScript compiler plugin entrypoint for Nest CLI.
 *
 * This module provides TypeScript transformer integration for soda-gql
 * when using Nest CLI with `builder: "tsc"`.
 */

export type { TypeScriptEnv } from "@soda-gql/tsc-transformer";

// Re-export transformer for backwards compatibility
export { createAfterStubTransformer, createTransformer } from "@soda-gql/tsc-transformer";
export * from "./plugin";

import plugin from "./plugin";

export const { before } = plugin;

export default plugin;
