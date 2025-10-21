/**
 * TypeScript compiler plugin entrypoint for Nest CLI.
 *
 * This module provides TypeScript transformer integration for soda-gql
 * when using Nest CLI with `builder: "tsc"`.
 */

export * from "./plugin";

import plugin from "./plugin";

export const { before, after } = plugin;

export default plugin;
