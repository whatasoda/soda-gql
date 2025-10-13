// Re-export from internal for external consumers
export type { BuilderChangeSet, BuilderFileChange } from "./session";
export { coercePaths, hasFileChanged } from "./session";
