import type { BuilderArtifact, BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";
import type { NormalizedOptions } from "../options";

/**
 * Immutable snapshot of coordinator state at a specific generation.
 */
export interface CoordinatorSnapshot {
  /** The complete builder artifact */
  readonly artifact: BuilderArtifact;
  /** All artifact elements indexed by canonical ID for quick lookup */
  readonly elements: Record<CanonicalId, BuilderArtifactElement>;
  /** Generation number - increments with each build/update */
  readonly generation: number;
  /** Timestamp when this snapshot was created */
  readonly createdAt: number;
  /** Normalized plugin options */
  readonly options: NormalizedOptions;
}

/**
 * Diff information between two artifact generations.
 */
export interface CoordinatorDiff {
  readonly added: ReadonlyArray<CanonicalId>;
  readonly updated: ReadonlyArray<CanonicalId>;
  readonly removed: ReadonlyArray<CanonicalId>;
}

/**
 * Event types emitted by coordinator subscriptions.
 */
export type CoordinatorEvent =
  | {
      readonly type: "artifact";
      readonly snapshot: CoordinatorSnapshot;
      readonly diff: CoordinatorDiff | null;
    }
  | {
      readonly type: "error";
      readonly error: unknown;
    }
  | {
      readonly type: "disposed";
    };

/**
 * Listener function for coordinator events.
 */
export type CoordinatorListener = (event: CoordinatorEvent) => void;

/**
 * Key for identifying unique coordinator instances.
 * Constructed from config path, project root, project name, and analyzer version.
 */
export type CoordinatorKey = string;
