import type { BuilderArtifact, BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";
import type { Result } from "neverthrow";
import { err, ok } from "neverthrow";
import { invalidateArtifactCache, loadArtifact } from "../cache";
import type { PluginError } from "../state";
import type { ArtifactProvider, ProviderContext } from "./artifact-provider";

/**
 * File-backed artifact provider.
 * Loads artifacts from a JSON file on disk.
 */
export class FileArtifactProvider implements ArtifactProvider {
  readonly mode = "artifact-file" as const;
  private artifactCache: BuilderArtifact | null = null;
  private readonly path: string;

  constructor(private context: ProviderContext) {
    const { artifact } = context.normalizedOptions;
    if (artifact.type !== "artifact-file") {
      throw new Error("FileArtifactProvider requires artifact-file type");
    }
    this.path = artifact.path;
  }

  async load(options?: { schemaHash?: string }): Promise<Result<BuilderArtifact, PluginError>> {
    // Return cached artifact if available
    if (this.artifactCache) {
      return ok(this.artifactCache);
    }

    const result = await loadArtifact(this.path);

    if (result.isErr()) {
      return err(this.mapArtifactError(result.error));
    }

    this.artifactCache = result.value;
    return ok(result.value);
  }

  invalidate(path?: string): void {
    const targetPath = path ?? this.path;
    invalidateArtifactCache(targetPath);
    if (targetPath === this.path) {
      this.artifactCache = null;
    }
  }

  getArtifactById(canonicalId: CanonicalId): BuilderArtifactElement | undefined {
    if (!this.artifactCache) {
      return undefined;
    }
    return this.artifactCache.elements[canonicalId];
  }

  describe(): string {
    return `FileArtifactProvider (${this.path})`;
  }

  private mapArtifactError(error: import("../cache").ArtifactError): PluginError {
    switch (error.code) {
      case "NOT_FOUND":
        // @ts-expect-error TODO: Fix PluginError type to accept ArtifactError
        return {
          type: "PluginError",
          stage: "artifact",
          code: "SODA_GQL_ARTIFACT_NOT_FOUND",
          message: "SODA_GQL_ARTIFACT_NOT_FOUND",
          cause: error,
          path: error.path,
        };
      case "PARSE_FAILED":
        // @ts-expect-error TODO: Fix PluginError type to accept ArtifactError
        return {
          type: "PluginError",
          stage: "artifact",
          code: "SODA_GQL_ARTIFACT_PARSE_FAILED",
          message: "SODA_GQL_ARTIFACT_PARSE_FAILED",
          cause: error,
          path: error.path,
        };
      default:
        // @ts-expect-error TODO: Fix PluginError type to accept ArtifactError
        return {
          type: "PluginError",
          stage: "artifact",
          code: "SODA_GQL_ARTIFACT_VALIDATION_FAILED",
          message: "SODA_GQL_ARTIFACT_VALIDATION_FAILED",
          cause: error,
          path: error.path,
        };
    }
  }
}
