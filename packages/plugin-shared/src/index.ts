// Re-export public APIs

// Coordinator (new architecture)
export * from "./coordinator/index.js";

// Adapters
export * from "./adapters/swc-adapter.js";
export * from "./adapters/typescript-adapter.js";

// Cache utilities
export {
  type ArtifactError,
  getArtifactCacheStats,
  invalidateArtifactCache,
  type LoadArtifactOptions,
  loadArtifact,
  lookupArtifact,
  resolveCanonicalId,
} from "./cache.js";

// Core
export * from "./core/ir.js";
export * from "./core/transform-adapter.js";

// Options and types
export * from "./errors.js";
export * from "./options.js";
export * from "./types.js";

// Legacy runtime (will be removed)
export * from "./runtime.js";

// State management
export * from "./state.js";

// Transform utilities
export * from "./transform/prepare-transform.js";
