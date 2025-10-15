/**
 * Synchronous transform preparation for TypeScript compiler plugins.
 *
 * TypeScript transformer factories must be synchronous, so we cannot use
 * async artifact loading. This module provides a sync alternative that
 * reads artifacts from disk synchronously.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BuilderArtifact, BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";

/**
 * Configuration for sync transform preparation.
 */
export type PrepareTransformSyncArgs = {
  readonly artifactPath: string;
  readonly importIdentifier?: string;
};

/**
 * Prepared state for transformation.
 */
export type PreparedTransformSync = {
  readonly artifactPath: string;
  readonly importIdentifier: string;
  readonly allArtifacts: Record<CanonicalId, BuilderArtifactElement>;
};

/**
 * Errors that can occur during sync preparation.
 */
export type PrepareTransformSyncError =
  | { readonly type: "ARTIFACT_NOT_FOUND"; readonly path: string }
  | { readonly type: "ARTIFACT_PARSE_FAILED"; readonly path: string; readonly cause: unknown }
  | { readonly type: "ARTIFACT_INVALID"; readonly path: string; readonly cause: unknown };

// Module-level cache keyed by artifact path + import identifier
const preparedStateCache = new Map<string, PreparedTransformSync>();

/**
 * Synchronously prepare transformation state by loading the artifact from disk.
 *
 * This function:
 * 1. Reads the artifact file synchronously
 * 2. Parses and validates the artifact
 * 3. Caches the result for subsequent calls
 * 4. Returns the prepared state for use by the transformer
 *
 * @param args - Configuration for preparation
 * @returns Result containing prepared state or error
 */
export function prepareTransformSync(
  args: PrepareTransformSyncArgs,
): Result<PreparedTransformSync, PrepareTransformSyncError> {
  const artifactPath = resolve(args.artifactPath);
  const importIdentifier = args.importIdentifier ?? "@/graphql-system";

  // Check cache
  const cacheKey = `${artifactPath}:${importIdentifier}`;
  const cached = preparedStateCache.get(cacheKey);
  if (cached) {
    return ok(cached);
  }

  // Read artifact file synchronously
  let artifactContent: string;
  try {
    artifactContent = readFileSync(artifactPath, "utf-8");
  } catch (error) {
    return err({
      type: "ARTIFACT_NOT_FOUND",
      path: artifactPath,
    });
  }

  // Parse artifact JSON
  let artifact: BuilderArtifact;
  try {
    artifact = JSON.parse(artifactContent) as BuilderArtifact;
  } catch (error) {
    return err({
      type: "ARTIFACT_PARSE_FAILED",
      path: artifactPath,
      cause: error,
    });
  }

  // Validate artifact structure
  if (!artifact || typeof artifact !== "object" || !artifact.elements) {
    return err({
      type: "ARTIFACT_INVALID",
      path: artifactPath,
      cause: new Error("Artifact missing required 'elements' field"),
    });
  }

  // Create prepared state
  const prepared: PreparedTransformSync = {
    artifactPath,
    importIdentifier,
    allArtifacts: artifact.elements,
  };

  // Cache for future use
  preparedStateCache.set(cacheKey, prepared);

  return ok(prepared);
}

/**
 * Clear the preparation cache.
 * Useful for testing or when artifacts change.
 */
export function clearPrepareSyncCache(): void {
  preparedStateCache.clear();
}
