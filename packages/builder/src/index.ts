/**
 * @deprecated Import from @soda-gql/common instead. These re-exports will be removed in the next major version.
 */
export type { CanonicalId, CanonicalPathTracker, ScopeFrame, ScopeHandle } from "@soda-gql/common";
/**
 * @deprecated Import from @soda-gql/common instead. These re-exports will be removed in the next major version.
 */
export {
  buildAstPath,
  createCanonicalId,
  createCanonicalTracker,
  createOccurrenceTracker,
  createPathTracker,
} from "@soda-gql/common";
export type {
  BuilderArtifact,
  BuilderArtifactElement,
  BuilderArtifactElementMetadata,
  BuilderArtifactInlineOperation,
  BuilderArtifactModel,
} from "./artifact/types";
export type {
  DiscoveredDependency,
  DiscoveryCache,
  DiscoverySnapshot,
} from "./discovery/types";
export type { GraphqlSystemIdentifyHelper } from "./internal/graphql-system";
export { createGraphqlSystemIdentifyHelper } from "./internal/graphql-system";
// Scheduler
export type { FileStats } from "./scheduler";
export { BuilderEffects, FileReadEffect, FileStatEffect } from "./scheduler";
export { BuilderArtifactSchema } from "./schemas/artifact";
export type { BuilderService, BuilderServiceConfig } from "./service";
export { createBuilderService } from "./service";
export type { BuilderSession } from "./session";
export { createBuilderSession } from "./session";
// Module adjacency for dependency tracking
export { collectAffectedFiles, extractModuleAdjacency } from "./session/module-adjacency";
export type {
  BuilderAnalyzer,
  BuilderError,
  BuilderFormat,
  BuilderInput,
  BuilderMode,
  BuilderOptions,
} from "./types";
