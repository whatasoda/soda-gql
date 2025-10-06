// Re-export change-set surface from internal/session
export type { BuilderChangeSet, BuilderChangeSetMetadata, BuilderFileChange } from "./internal/session/change-set";
export { coercePaths, hasFileChanged, shouldInvalidateAnalyzer, shouldInvalidateSchema } from "./internal/session/change-set";
