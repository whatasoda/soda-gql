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
export type { CanonicalId } from "./utils/canonical-id";
export { createCanonicalId } from "./utils/canonical-id";
export type { CanonicalPathTracker, ScopeFrame, ScopeHandle } from "./canonical/path-tracker";
export { buildAstPath, createCanonicalTracker, createOccurrenceTracker, createPathTracker } from "./canonical/path-tracker";
export { runBuilder } from "./runner";
export type {
  BuilderAnalyzer,
  BuilderArtifact,
  BuilderArtifactModel,
  BuilderArtifactOperation,
  BuilderArtifactSlice,
  BuilderError,
  BuilderFormat,
  BuilderMode,
  BuilderOptions,
  BuilderSuccess,
} from "./types";
