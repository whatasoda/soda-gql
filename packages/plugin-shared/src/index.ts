// Re-export public APIs

// Adapters
export * from "./adapters/swc-adapter";
export type { ArtifactError, LoadArtifactOptions } from "./cache";
// Cache utilities
export {
  getArtifactCacheStats,
  invalidateArtifactCache,
  loadArtifact,
  lookupArtifact,
  resolveCanonicalId,
} from "./cache";
// Coordinator (new architecture)
export * from "./coordinator/index";

// Core
export * from "./core/ir";
export * from "./core/transform-adapter";

// Options and types
export * from "./errors";
export * from "./options";
// Legacy runtime (will be removed)
export * from "./runtime";
// State management
export * from "./state";
// Transform utilities
export * from "./transform/prepare-transform";
export * from "./types";
