import type { ModuleAnalysis } from "./ast/analyze-module";

export type ModuleCache = {
  readonly store: (analysis: ModuleAnalysis) => void;
  readonly load: (filePath: string, sourceHash: string) => ModuleAnalysis | null;
};

export type ModuleCacheOptions = {
  readonly rootDir: string;
};

export const createModuleCache = (_options: ModuleCacheOptions): ModuleCache => ({
  store: () => {
    // not implemented yet
  },
  load: () => null,
});
