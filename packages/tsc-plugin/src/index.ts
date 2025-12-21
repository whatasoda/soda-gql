/**
 * TypeScript compiler plugin entrypoint for Nest CLI.
 *
 * This module provides TypeScript transformer integration for soda-gql
 * when using Nest CLI with `builder: "tsc"`.
 */

export * from "./plugin";

// Re-export transformer for backwards compatibility
export { createTransformer, createAfterStubTransformer } from "@soda-gql/tsc-transformer";
export type { TypeScriptEnv } from "@soda-gql/tsc-transformer";

import plugin from "./plugin";

export const { before } = plugin;

export default plugin;
