import type { BuilderArtifact, CanonicalId } from "@soda-gql/builder";
import type { NormalizedOptions } from "../options.js";
import type { CoordinatorDiff, CoordinatorSnapshot } from "./types.js";

/**
 * Create a snapshot from builder artifact and options.
 */
export const createSnapshot = (
  artifact: BuilderArtifact,
  options: NormalizedOptions,
  generation: number,
): CoordinatorSnapshot => {
  return {
    artifact,
    elements: artifact.elements,
    generation,
    createdAt: Date.now(),
    options,
  };
};

/**
 * Compute diff between two snapshots.
 */
export const computeDiff = (
  prevSnapshot: CoordinatorSnapshot | null,
  nextSnapshot: CoordinatorSnapshot,
): CoordinatorDiff | null => {
  if (!prevSnapshot) {
    // First snapshot - everything is "added"
    return {
      added: Object.keys(nextSnapshot.elements) as CanonicalId[],
      updated: [],
      removed: [],
    };
  }

  const added: CanonicalId[] = [];
  const updated: CanonicalId[] = [];
  const removed: CanonicalId[] = [];

  const prevIds = new Set(Object.keys(prevSnapshot.elements));
  const nextIds = new Set(Object.keys(nextSnapshot.elements));

  // Find added and updated
  for (const id of nextIds) {
    if (!prevIds.has(id)) {
      added.push(id as CanonicalId);
    } else {
      // Check if content changed
      const prevElement = prevSnapshot.elements[id as CanonicalId];
      const nextElement = nextSnapshot.elements[id as CanonicalId];
      if (prevElement !== nextElement) {
        updated.push(id as CanonicalId);
      }
    }
  }

  // Find removed
  for (const id of prevIds) {
    if (!nextIds.has(id)) {
      removed.push(id as CanonicalId);
    }
  }

  return { added, updated, removed };
};
