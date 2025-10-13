import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { err, ok, type Result } from "neverthrow";
import type { BuilderArtifact } from "./artifact/types";
import { createBuilderService } from "./service";
import type { BuilderAnalyzer, BuilderError, BuilderFormat, BuilderResult } from "./types";
import { writeArtifact } from "./writer";

/**
 * Legacy builder options for backward compatibility.
 * @deprecated Use createBuilderService instead for new code.
 */
export type LegacyBuilderOptions = {
  readonly mode?: "runtime" | "zero-runtime";
  readonly entry: readonly string[];
  readonly outPath: string;
  readonly format: BuilderFormat;
  readonly analyzer: BuilderAnalyzer;
  readonly schemaHash?: string; // Deprecated, no longer used
  readonly debugDir?: string; // TODO: Re-implement debug output
  readonly config: ResolvedSodaGqlConfig;
  readonly evaluatorId?: string;
};

/**
 * Legacy runBuilder function for backward compatibility.
 *
 * @deprecated This is a compatibility wrapper. New code should use:
 * ```typescript
 * const service = createBuilderService(config);
 * const result = await service.build();
 * ```
 *
 * This wrapper exists to maintain compatibility with existing tests and CLI code.
 * It will be removed in a future major version.
 */
export const runBuilder = async (options: LegacyBuilderOptions): Promise<BuilderResult> => {
  // Create service with config
  const service = createBuilderService(options.config);

  // Build artifact
  const buildResult = await service.build();

  if (buildResult.isErr()) {
    return err(buildResult.error);
  }

  const artifact = buildResult.value;

  // Write artifact to disk (legacy behavior)
  return writeArtifact(options.outPath, artifact);
};

/**
 * Generate artifact without writing to disk.
 *
 * @deprecated Use createBuilderService(config).build() instead.
 */
export const generateArtifact = async (
  options: Omit<LegacyBuilderOptions, "outPath" | "format">,
): Promise<Result<BuilderArtifact, BuilderError>> => {
  const service = createBuilderService(options.config);
  return service.build();
};
