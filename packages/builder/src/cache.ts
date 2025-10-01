import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ModuleAnalysis } from "./ast/analyze-module";
import { ModuleAnalysisSchema } from "./schemas/cache";

export type ModuleCache = {
	readonly store: (analysis: ModuleAnalysis) => void;
	readonly load: (
		filePath: string,
		signature: string,
	) => ModuleAnalysis | null;
};

export type ModuleCacheOptions = {
  readonly rootDir: string;
};

const createKey = (filePath: string): string => Bun.hash(filePath).toString(16);

const ensureDirectory = (path: string): void => {
  mkdirSync(path, { recursive: true });
};

export const createModuleCache = ({ rootDir }: ModuleCacheOptions): ModuleCache => {
  const resolveEntryPath = (filePath: string) => join(rootDir, `${createKey(filePath)}.json`);

  return {
    store: (analysis) => {
      ensureDirectory(rootDir);
      const targetPath = resolveEntryPath(analysis.filePath);
      writeFileSync(targetPath, JSON.stringify(analysis));
    },

		load: (filePath, signature) => {
			const targetPath = resolveEntryPath(filePath);
			if (!existsSync(targetPath)) {
				return null;
			}

			try {
				const raw = readFileSync(targetPath, "utf8");
				const parsed = ModuleAnalysisSchema.parse(JSON.parse(raw));
				if (parsed.signature !== signature) {
					return null;
				}
				return parsed as ModuleAnalysis;
			} catch {
				return null;
			}
		},
  } satisfies ModuleCache;
};
