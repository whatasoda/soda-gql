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
  BuilderArtifactModel,
  BuilderArtifactOperation,
  BuilderArtifactSlice,
} from "./artifact/types";
export type {
  DiscoveredDependency,
  DiscoveryCache,
  DiscoverySnapshot,
} from "./discovery/types";
export { BuilderArtifactSchema } from "./schemas/artifact";
export type { BuilderService, BuilderServiceConfig } from "./service";
export { createBuilderService } from "./service";
export type { BuilderSession } from "./session";
export { createBuilderSession } from "./session";
export type {
  BuilderAnalyzer,
  BuilderError,
  BuilderFormat,
  BuilderInput,
  BuilderMode,
  BuilderOptions,
} from "./types";
