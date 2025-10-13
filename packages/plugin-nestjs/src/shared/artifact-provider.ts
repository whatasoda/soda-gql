/**
 * Shared artifact provider utilities for plugin-nestjs.
 * Wraps plugin-shared's ArtifactProvider for NestJS and webpack use cases.
 */

import { resolve } from "node:path";
import type { ArtifactProvider, NormalizedOptions } from "@soda-gql/plugin-shared";
import { createArtifactProvider, normalizePluginOptions } from "@soda-gql/plugin-shared";
import type { NestModuleOptions } from "../schemas/module.js";

/**
 * Create an artifact provider from NestJS module options.
 * Maps Nest-specific options to shared PluginOptions, normalizes them,
 * and creates the appropriate provider.
 */
export const createNestArtifactProvider = async (options: NestModuleOptions): Promise<ArtifactProvider> => {
  // Normalize options using the shared normalizer
  const normalizedResult = await normalizePluginOptions({
    mode: "runtime", // Nest runtime always uses runtime mode
    artifact: {
      useBuilder: false, // Nest uses pre-built artifact files
      path: resolve(options.artifactPath),
    },
  });

  if (normalizedResult.isErr()) {
    throw new Error(`Failed to normalize options: ${normalizedResult.error.message}`);
  }

  const normalizedOptions: NormalizedOptions = normalizedResult.value;
  return createArtifactProvider(normalizedOptions);
};
