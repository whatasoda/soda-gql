export type { CanonicalId, CanonicalPathTracker, ScopeFrame, ScopeHandle } from "./canonical-id";
export {
  buildAstPath,
  createCanonicalId,
  createCanonicalTracker,
  createOccurrenceTracker,
  createPathTracker,
} from "./canonical-id";
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
export { generateArtifact, runBuilder } from "./runner";
export type { BuilderService, BuilderServiceConfig } from "./service";
export { createBuilderService } from "./service";
export type {
  BuilderAnalyzer,
  BuilderArtifact,
  BuilderArtifactModel,
  BuilderArtifactOperation,
  BuilderArtifactSlice,
  BuilderError,
  BuilderFormat,
  BuilderInput,
  BuilderMode,
  BuilderOptions,
  BuilderResult,
  BuilderSuccess,
} from "./types";
