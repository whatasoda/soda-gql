/**
 * NestJS integration utilities for webpack configuration.
 *
 * Provides the withSodaGql helper for seamlessly integrating soda-gql
 * into NestJS webpack configurations.
 */

export { type SodaGqlConfig, sodaGqlConfigSchema } from "./config-schema.js";
export { type NestWebpackConfigFactory, withSodaGql } from "./with-soda-gql.js";
