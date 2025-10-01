import { analyzeModule } from "../../ast/analyze-module";
import type { ModuleAnalysis } from "../../ast/analyze-module";
import type {
	AstParser,
	AstParserInput,
	DiscoveredDependency,
} from "../types";
import { isExternalSpecifier, resolveRelativeImport } from "../fs-utils";

/**
 * Extract all unique dependencies (relative + external) from the analysis.
 * Resolves local specifiers immediately so discovery only traverses once.
 */
export const extractModuleDependencies = (
	analysis: ModuleAnalysis,
): readonly DiscoveredDependency[] => {
	const dependencies = new Map<string, DiscoveredDependency>();

	const addDependency = (specifier: string): void => {
		if (dependencies.has(specifier)) {
			return;
		}

		const isExternal = isExternalSpecifier(specifier);
		const resolvedPath = isExternal
			? null
			: resolveRelativeImport(analysis.filePath, specifier);

		dependencies.set(specifier, {
			specifier,
			resolvedPath,
			isExternal,
		});
	};

	for (const imp of analysis.imports) {
		addDependency(imp.source);
	}

	for (const exp of analysis.exports) {
		if (exp.kind === "reexport") {
			addDependency(exp.source);
		}
	}

	return Array.from(dependencies.values());
};

/**
 * Extract only resolved paths for backward compatibility with AstParser interface.
 */
const resolveRelativeDependencies = (
	analysis: ModuleAnalysis,
): readonly string[] => {
	const resolved: string[] = [];

	for (const dep of extractModuleDependencies(analysis)) {
		if (!dep.isExternal && dep.resolvedPath) {
			resolved.push(dep.resolvedPath);
		}
	}

	return resolved;
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

