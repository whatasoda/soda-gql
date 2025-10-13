// Re-export from internal for external consumers
export type { BuilderChangeSet, BuilderFileChange } from "./internal/session/change-set";
export { coercePaths, hasFileChanged } from "./internal/session/change-set";
