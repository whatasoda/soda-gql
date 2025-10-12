// Re-export change-set surface from internal/session
export type { BuilderChangeSet, BuilderFileChange } from "./internal/session/change-set";
export { coercePaths, hasFileChanged } from "./internal/session/change-set";
