/**
 * TypeScript compiler plugin entrypoint for Nest CLI.
 *
 * This module provides TypeScript transformer integration for soda-gql
 * when using Nest CLI with `builder: "tsc"`.
 */

export { before, createSodaGqlTransformer, default, type TransformerConfig } from "./transformer.js";
