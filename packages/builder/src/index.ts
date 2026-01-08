export type { ArtifactLoadError, ArtifactLoadErrorCode } from "./artifact/loader";
export { loadArtifact, loadArtifactSync } from "./artifact/loader";
export type {
  BuilderArtifact,
  BuilderArtifactElement,
  BuilderArtifactElementMetadata,
  BuilderArtifactFragment,
  BuilderArtifactMeta,
  BuilderArtifactOperation,
} from "./artifact/types";
export type {
  DiscoveredDependency,
  DiscoveryCache,
  DiscoverySnapshot,
} from "./discovery/types";
export type { FormattedError } from "./errors/formatter";
export { formatBuilderErrorForCLI, formatBuilderErrorStructured } from "./errors/formatter";
// Internal utility for testing - clears gql module cache between test runs
export { __clearGqlCache } from "./intermediate-module";
export type { GraphqlSystemIdentifyHelper } from "./internal/graphql-system";
export { createGraphqlSystemIdentifyHelper } from "./internal/graphql-system";
// Prebuilt type generation
export {
  emitPrebuiltTypes,
  extractFieldSelections,
  type FieldSelectionsMap,
  type PrebuiltTypesEmitterOptions,
} from "./prebuilt";
// Schema loading
export { loadSchemasFromBundle, type LoadSchemasResult } from "./schema-loader";
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
