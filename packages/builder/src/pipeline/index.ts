/**
 * Builder pipeline stages.
 *
 * This module provides composable pipeline stages for the builder.
 * Each stage is a pure function (aside from filesystem operations) that can be
 * orchestrated to create custom build flows.
 */

export type { BuildArtifactInput } from "../artifact";
// Re-export artifact assembler
export { buildArtifact } from "../artifact";
export type { DependencyGraph, DependencyGraphNode } from "../dependency-graph";
// Re-export dependency graph builder
export { buildDependencyGraph } from "../dependency-graph";
export type { CreateIntermediateModuleInput, IntermediateModule } from "../intermediate-module";
// Re-export intermediate module emitter
export { createIntermediateModule } from "../intermediate-module";
export type {
  CreateDiscoveryPipelineOptions,
  DiscoveryPipeline,
  LoadedModules,
  ModuleLoadStats,
} from "../module-loader";
// Re-export module loader types and factory
export { createDiscoveryPipeline } from "../module-loader";
