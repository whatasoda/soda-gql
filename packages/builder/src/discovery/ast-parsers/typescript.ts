import { analyzeModule } from "../../ast/analyze-module";
import type { ModuleAnalysis } from "../../ast/analyze-module";
import type { AstParser, AstParserInput } from "../types";
import {
	isRelativeSpecifier,
	resolveRelativeImport,
} from "../fs-utils";

export type ResolvedDependency = {
	readonly specifier: string;
	readonly resolvedPath: string;
};

/**
 * Extract all unique relative dependencies from a ModuleAnalysis.
 * Returns both the specifier and its resolved absolute path.
 */
const extractRelativeDependencies = (
	analysis: ModuleAnalysis,
): readonly ResolvedDependency[] => {
	const dependencies = new Map<string, string>();

	// Collect from imports
	for (const imp of analysis.imports) {
		if (isRelativeSpecifier(imp.source)) {
			const resolved = resolveRelativeImport(analysis.filePath, imp.source);
			if (resolved) {
				dependencies.set(imp.source, resolved);
			}
		}
	}

	// Collect from reexports
	for (const exp of analysis.exports) {
		if (exp.kind === "reexport" && isRelativeSpecifier(exp.source)) {
			const resolved = resolveRelativeImport(analysis.filePath, exp.source);
			if (resolved) {
				dependencies.set(exp.source, resolved);
			}
		}
	}

	return Array.from(dependencies.entries()).map(([specifier, resolvedPath]) => ({
		specifier,
		resolvedPath,
	}));
};

/**
 * Extract only resolved paths for backward compatibility with AstParser interface.
 */
const resolveRelativeDependencies = (
	analysis: ModuleAnalysis,
): readonly string[] => {
	return extractRelativeDependencies(analysis).map((dep) => dep.resolvedPath);
};

/**
 * TypeScript AST parser implementation.
 * Uses the existing TypeScript analyzer and extracts dependencies from the analysis result.
 */
export const typeScriptAstParser: AstParser = {
	analyzer: "ts",
	supportedFileExtensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"],

	parseModule: (input: AstParserInput): ModuleAnalysis =>
		analyzeModule({ filePath: input.filePath, source: input.source }),

	createSourceHash: (source: string): string =>
		Bun.hash(source).toString(16),

	resolveRelativeDependencies,
};

/**
 * Extract relative dependencies with both specifier and resolved path.
 * Useful for building dependency maps in the discoverer.
 */
export { extractRelativeDependencies };
