/**
 * TypeScript compiler plugin entrypoint for Nest CLI.
 *
 * This module provides TypeScript transformer integration for soda-gql
 * when using Nest CLI with `builder: "tsc"`.
 */

export { createSodaGqlTransformer, type TransformerConfig } from "./transformer.js";
export { default } from "./transformer.js";
