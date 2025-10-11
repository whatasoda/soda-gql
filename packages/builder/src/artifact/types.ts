import type { CanonicalId } from "@soda-gql/common";
import type { RuntimeModelInput, RuntimeOperationInput, RuntimeSliceInput } from "@soda-gql/core/runtime";
import type { DependencyGraph } from "../dependency-graph";
import type { ModuleLoadStats } from "../discovery/discovery-pipeline";
import type { ChunkDiff, ChunkManifest } from "../internal/intermediate-module/chunks";

export type BuildArtifactInput = {
  readonly graph: DependencyGraph;
  readonly cache: ModuleLoadStats;
  readonly chunks?: { written: number; skipped: number }; // Chunk write statistics
  readonly intermediateModulePath?: string; // Legacy single-file mode
  readonly intermediateModulePaths?: Map<string, string>; // Chunk mode: chunkId → transpiledPath
  readonly evaluatorId: string;
};

export type BuilderArtifactOperation = {
  readonly id: CanonicalId;
  readonly type: "operation";
  readonly prebuild: RuntimeOperationInput["prebuild"];
};

export type BuilderArtifactSlice = {
  readonly id: CanonicalId;
  readonly type: "slice";
  readonly prebuild: RuntimeSliceInput["prebuild"];
};

export type BuilderArtifactModel = {
  readonly id: CanonicalId;
  readonly type: "model";
  readonly prebuild: RuntimeModelInput["prebuild"];
};

export type BuilderArtifactElement = BuilderArtifactOperation | BuilderArtifactSlice | BuilderArtifactModel;

export type BuilderArtifact = {
  readonly elements: Record<CanonicalId, BuilderArtifactElement>;

  readonly report: {
    readonly durationMs: number;
    readonly warnings: readonly string[];
    readonly cache: {
      readonly hits: number;
      readonly misses: number;
      readonly skips: number;
    };
    readonly chunks: {
      readonly written: number;
      readonly skipped: number;
    };
  };
};

/**
 * Delta representing changes in builder artifact between builds.
 */
export type BuilderArtifactDelta = {
  /** Added elements (new definitions) */
  readonly added: Record<CanonicalId, BuilderArtifactElement>;
  /** Updated elements (modified definitions) */
  readonly updated: Record<CanonicalId, BuilderArtifactElement>;
  /** Removed element IDs */
  readonly removed: Set<CanonicalId>;
  /** Chunk-level changes */
  readonly chunks: ChunkDiff;
  /** Updated chunk manifest */
  readonly manifest: ChunkManifest;
};
