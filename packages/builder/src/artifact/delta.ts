import type { CanonicalId } from "@soda-gql/common";
import type { ChunkDiff, ChunkManifest } from "../internal/intermediate-module/chunks";
import type { BuilderArtifact, BuilderArtifactDelta, BuilderArtifactElement } from "./types";

/**
 * Compute delta between two artifacts.
 */
export const computeArtifactDelta = (
  oldArtifact: BuilderArtifact | null,
  newArtifact: BuilderArtifact,
  chunkDiff: ChunkDiff,
  manifest: ChunkManifest,
): BuilderArtifactDelta => {
  const added: Record<CanonicalId, BuilderArtifactElement> = {};
  const updated: Record<CanonicalId, BuilderArtifactElement> = {};
  const removed = new Set<CanonicalId>();

  if (!oldArtifact) {
    // Everything is new
    return {
      added: newArtifact.elements,
      updated: {},
      removed: new Set(),
      chunks: chunkDiff,
      manifest,
    };
  }

  const oldElements = oldArtifact.elements;
  const newElements = newArtifact.elements;

  // Find added and updated elements
  for (const [id, newElement] of Object.entries(newElements)) {
    const canonicalId = id as CanonicalId;
    const oldElement = oldElements[canonicalId];
    if (!oldElement) {
      added[canonicalId] = newElement;
    } else if (!elementsEqual(oldElement, newElement)) {
      updated[canonicalId] = newElement;
    }
  }

  // Find removed elements
  for (const id of Object.keys(oldElements)) {
    const canonicalId = id as CanonicalId;
    if (!newElements[canonicalId]) {
      removed.add(canonicalId);
    }
  }

  return {
    added,
    updated,
    removed,
    chunks: chunkDiff,
    manifest,
  };
};

/**
 * Check if two artifact elements are equal.
 */
const elementsEqual = (a: BuilderArtifactElement, b: BuilderArtifactElement): boolean => {
  if (a.type !== b.type) {
    return false;
  }

  // Deep compare prebuild objects
  return JSON.stringify(a.prebuild) === JSON.stringify(b.prebuild);
};

/**
 * Apply delta to an artifact, returning updated artifact.
 */
export const applyArtifactDelta = (baseArtifact: BuilderArtifact, delta: BuilderArtifactDelta): BuilderArtifact => {
  const elements = { ...baseArtifact.elements };

  // Apply removals
  for (const id of delta.removed) {
    delete elements[id];
  }

  // Apply additions and updates
  Object.assign(elements, delta.added, delta.updated);

  return {
    ...baseArtifact,
    elements,
  };
};
