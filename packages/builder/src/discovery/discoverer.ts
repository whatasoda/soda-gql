import { readFileSync } from "node:fs";
import { createCanonicalId } from "../registry";
import type {
	AstParser,
	DiscoveredDependency,
	DiscoveryCache,
	DiscoverySnapshot,
	DiscoverySnapshotDefinition,
} from "./types";
import { isExternalSpecifier, normalizeToPosix } from "./fs-utils";
import { extractRelativeDependencies } from "./ast-parsers/typescript";

export type DiscoverModulesOptions = {
	readonly entryPaths: readonly string[];
	readonly parser: AstParser;
	readonly cache?: DiscoveryCache;
};

export type DiscoverModulesResult = {
	readonly snapshots: readonly DiscoverySnapshot[];
	readonly cacheHits: number;
	readonly cacheMisses: number;
};

/**
 * Discover and analyze all modules starting from entry points.
 * Uses AST parsing instead of RegExp for reliable dependency extraction.
 * Supports caching to skip re-parsing unchanged files.
 */
export const discoverModules = ({
	entryPaths,
	parser,
	cache,
}: DiscoverModulesOptions): DiscoverModulesResult => {
	const snapshots = new Map<string, DiscoverySnapshot>();
	const stack = [...entryPaths];
	let cacheHits = 0;
	let cacheMisses = 0;

	while (stack.length > 0) {
		const filePath = stack.pop();
		if (!filePath || snapshots.has(filePath)) {
			continue;
		}

		// Read source and compute signature
		const source = readFileSync(filePath, "utf8");
		const signature = parser.createSourceHash(source);

		// Check cache first
		if (cache) {
			const cached = cache.load(filePath, signature);
			if (cached) {
				snapshots.set(filePath, cached);
				cacheHits++;
				// Enqueue dependencies from cache
				for (const dep of cached.dependencies) {
					if (dep.resolvedPath && !snapshots.has(dep.resolvedPath)) {
						stack.push(dep.resolvedPath);
					}
				}
				continue;
			}
		}

		// Parse module
		const analysis = parser.parseModule({ filePath, source });
		cacheMisses++;

		// Extract relative dependencies with exact specifier-to-path mapping
		const relativeDeps = extractRelativeDependencies(analysis);
		const specifierToPath = new Map(
			relativeDeps.map((dep) => [dep.specifier, dep.resolvedPath]),
		);

		// Collect all unique specifiers and build dependency records
		const allSpecifiers = new Set<string>();
		for (const imp of analysis.imports) {
			allSpecifiers.add(imp.source);
		}
		for (const exp of analysis.exports) {
			if (exp.kind === "reexport") {
				allSpecifiers.add(exp.source);
			}
		}

		const dependencies: DiscoveredDependency[] = [];
		for (const specifier of allSpecifiers) {
			const isExternal = isExternalSpecifier(specifier);
			const resolvedPath = isExternal
				? null
				: specifierToPath.get(specifier) ?? null;

			dependencies.push({
				specifier,
				resolvedPath,
				isExternal,
			});
		}

		// Enqueue all resolved relative dependencies for traversal
		for (const dep of relativeDeps) {
			if (!snapshots.has(dep.resolvedPath)) {
				stack.push(dep.resolvedPath);
			}
		}

		// Create definitions with canonical IDs
		const definitions: DiscoverySnapshotDefinition[] = analysis.definitions.map(
			(def) => ({
				...def,
				canonicalId: createCanonicalId(filePath, def.exportName),
			}),
		);

		// Create snapshot
		const snapshot: DiscoverySnapshot = {
			filePath,
			normalizedFilePath: normalizeToPosix(filePath),
			analyzer: parser.analyzer,
			signature,
			createdAtMs: Date.now(),
			analysis,
			definitions,
			dependencies,
			diagnostics: analysis.diagnostics,
			exports: analysis.exports,
			imports: analysis.imports,
		};

		snapshots.set(filePath, snapshot);

		// Store in cache
		if (cache) {
			cache.store(snapshot);
		}

		// Call optional hook
		parser.onSnapshotCreated?.(snapshot);
	}

	return {
		snapshots: Array.from(snapshots.values()),
		cacheHits,
		cacheMisses,
	};
};
