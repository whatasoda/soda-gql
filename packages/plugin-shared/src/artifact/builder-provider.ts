import type { BuilderArtifact, BuilderArtifactElement, BuilderService, CanonicalId } from "@soda-gql/builder";
import { createBuilderService } from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";
import type { PluginError } from "../state";
import type { ArtifactProvider, ProviderContext } from "./artifact-provider";

/**
 * Builder-backed artifact provider.
 * Uses BuilderService to generate artifacts on-demand.
 */
export class BuilderArtifactProvider implements ArtifactProvider {
  readonly mode = "builder" as const;
  private service: BuilderService;
  private artifactCache: BuilderArtifact | null = null;

  constructor(private context: ProviderContext) {
    const { artifact } = context.normalizedOptions;
    if (artifact.type !== "builder") {
      throw new Error("BuilderArtifactProvider requires builder artifact type");
    }
    this.service = createBuilderService(artifact.config);
  }

  async load(): Promise<Result<BuilderArtifact, PluginError>> {
    // Return cached artifact if available
    if (this.artifactCache) {
      return ok(this.artifactCache);
    }

    try {
      const buildResult = await this.service.build();

      if (buildResult.isErr()) {
        return err(this.mapBuilderError(buildResult.error));
      }

      this.artifactCache = buildResult.value;
      return ok(buildResult.value);
    } catch (cause) {
      return err(this.mapUnexpectedError(cause));
    }
  }

  invalidate(): void {
    this.artifactCache = null;
  }

  getArtifactById(canonicalId: CanonicalId): BuilderArtifactElement | undefined {
    if (!this.artifactCache) {
      return undefined;
    }
    return this.artifactCache.elements[canonicalId];
  }

  describe(): string {
    const { artifact } = this.context.normalizedOptions;
    if (artifact.type !== "builder") {
      return "BuilderArtifactProvider (invalid configuration)";
    }
    const entrypoints = artifact.config.entrypoints;
    const entryCount = Array.isArray(entrypoints)
      ? entrypoints.length
      : (entrypoints as ReadonlySet<string>).size;
    return `BuilderArtifactProvider (${entryCount} entries)`;
  }

  private mapBuilderError(error: import("@soda-gql/builder").BuilderError): PluginError {
    switch (error.code) {
      case "ENTRY_NOT_FOUND":
        return {
          type: "PluginError",
          stage: "builder",
          code: "SODA_GQL_BUILDER_ENTRY_NOT_FOUND",
          message: `SODA_GQL_BUILDER_ENTRY_NOT_FOUND: ${error.message} (entry: ${error.entry})`,
          cause: error,
          entry: error.entry,
        };
      case "DOC_DUPLICATE":
        return {
          type: "PluginError",
          stage: "builder",
          code: "SODA_GQL_BUILDER_DOC_DUPLICATE",
          message: `SODA_GQL_BUILDER_DOC_DUPLICATE: ${error.name} found in multiple sources: ${error.sources.join(", ")}`,
          cause: error,
          name: error.name,
          sources: error.sources,
        };
      case "GRAPH_CIRCULAR_DEPENDENCY":
        return {
          type: "PluginError",
          stage: "builder",
          code: "SODA_GQL_BUILDER_CIRCULAR_DEPENDENCY",
          message: `SODA_GQL_BUILDER_CIRCULAR_DEPENDENCY: ${error.chain.join(" → ")}`,
          cause: error,
          chain: error.chain,
        };
      case "RUNTIME_MODULE_LOAD_FAILED":
        return {
          type: "PluginError",
          stage: "builder",
          code: "SODA_GQL_BUILDER_MODULE_EVALUATION_FAILED",
          message: `SODA_GQL_BUILDER_MODULE_EVALUATION_FAILED: ${error.message} at ${error.filePath}:${error.astPath}`,
          cause: error,
          filePath: error.filePath,
          astPath: error.astPath,
        };
      case "WRITE_FAILED":
        return {
          type: "PluginError",
          stage: "builder",
          code: "SODA_GQL_BUILDER_WRITE_FAILED",
          message: `SODA_GQL_BUILDER_WRITE_FAILED: ${error.message} (path: ${error.outPath})`,
          cause: error,
          outPath: error.outPath,
        };
      default:
        return this.mapUnexpectedError(error);
    }
  }

  private mapUnexpectedError(cause: unknown): PluginError {
    return {
      type: "PluginError",
      stage: "builder",
      code: "SODA_GQL_BUILDER_UNEXPECTED",
      message: `SODA_GQL_BUILDER_UNEXPECTED: ${this.describeUnknown(cause)}`,
      cause,
    };
  }

  private describeUnknown(value: unknown): string {
    if (value instanceof Error) {
      return value.message;
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
