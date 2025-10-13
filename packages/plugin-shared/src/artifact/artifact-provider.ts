import type { BuilderArtifact, BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";
import type { Result } from "neverthrow";
import type { NormalizedOptions } from "../options";
import type { PluginError } from "../state";

/**
 * Artifact provider interface for loading builder artifacts.
 * Abstracts the source of artifacts (builder vs file) for plugin state preparation.
 */
export interface ArtifactProvider {
  /** Provider mode identifier */
  readonly mode: "builder" | "artifact-file";

  /**
   * Load the builder artifact.
   * @param options Optional loading options (e.g., schema hash for validation)
   */
  load(options?: { schemaHash?: string }): Promise<Result<BuilderArtifact, PluginError>>;

  /**
   * Invalidate cached artifacts (optional, mainly for file-based caching).
   * @param path Optional path to invalidate (defaults to provider's configured path)
   */
  invalidate?(path?: string): void;

  /**
   * Get a specific artifact element by canonical ID.
   * @param canonicalId The canonical ID of the artifact element
   */
  getArtifactById?(canonicalId: CanonicalId): BuilderArtifactElement | undefined;

  /**
   * Get human-readable description for diagnostics.
   */
  describe?(): string;
}

/**
 * Context passed to artifact provider factories.
 */
export type ProviderContext = {
  readonly normalizedOptions: NormalizedOptions;
};

/**
 * Factory function type for creating artifact providers.
 */
export type ArtifactProviderFactory = (context: ProviderContext) => ArtifactProvider;

/**
 * Create an appropriate artifact provider based on normalized options.
 * @param normalizedOptions The normalized plugin options
 * @returns An artifact provider instance
 */
export const createArtifactProvider = (normalizedOptions: NormalizedOptions): ArtifactProvider => {
  const context: ProviderContext = { normalizedOptions };

  switch (normalizedOptions.artifact.type) {
    case "builder": {
      // Import dynamically to avoid circular dependencies
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { BuilderArtifactProvider } = require("./builder-provider");
      return new BuilderArtifactProvider(context);
    }
    case "artifact-file": {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { FileArtifactProvider } = require("./file-provider");
      return new FileArtifactProvider(context);
    }
  }
};
