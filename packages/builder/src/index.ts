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
  BuilderArtifactModel,
  BuilderArtifactOperation,
  BuilderArtifactSlice,
} from "./artifact/types";
export type {
  DiscoveredDependency,
  DiscoveryCache,
  DiscoverySnapshot,
  DiscoverySnapshotDefinition,
  ModuleEvaluationDefinition,
  ModuleEvaluationIssue,
  ModuleEvaluationKind,
  ModuleEvaluationResult,
  ModuleEvaluator,
  ModuleEvaluatorContext,
  ModuleEvaluatorInput,
} from "./discovery/types";
export { BuilderArtifactSchema } from "./schemas/artifact";
export type { BuilderService, BuilderServiceConfig } from "./service";
export { createBuilderService } from "./service";
export type {
  BuilderAnalyzer,
  BuilderError,
  BuilderFormat,
  BuilderInput,
  BuilderMode,
  BuilderOptions,
  BuilderResult,
  BuilderSuccess,
} from "./types";
export type { BuilderChangeSet, BuilderFileChange } from "./change-set";
export { coercePaths, hasFileChanged } from "./change-set";
export type { BuilderSession, BuilderSessionSnapshot } from "./internal/session/builder-session";
export { createBuilderSession, __internal } from "./internal/session/builder-session";
export type { LegacyBuilderOptions } from "./runner";
export { runBuilder, generateArtifact } from "./runner";
