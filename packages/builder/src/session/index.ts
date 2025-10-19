export type { BuilderSession } from "./builder-session";
export { createBuilderSession } from "./builder-session";
export type { BuilderChangeSet, BuilderFileChange } from "./change-set";
export { coercePaths, hasFileChanged } from "./change-set";
export { validateModuleDependencies } from "./dependency-validation";
export { collectAffectedFiles, extractModuleAdjacency } from "./module-adjacency";
