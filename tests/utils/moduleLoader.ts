import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Reusable transpiler instance
const transpiler = new Bun.Transpiler({
	loader: "ts",
	target: "node",
});

// Optional: Simple memoization cache
const transformCache = new Map<string, string>();

/**
 * Loads transformed TypeScript code as an ESM module
 * @param filePath Original file path for cache key and relative path calculation
 * @param transformedCode The transformed code to transpile
 * @param outputDir Directory to write the transpiled module
 * @param options Optional configuration
 * @returns Imported module
 */
export const loadTransformedModule = async (
	filePath: string,
	transformedCode: string,
	outputDir: string,
	options?: { cache?: boolean },
) => {
	const cacheKey = `${filePath}:${transformedCode}`;

	let jsCode: string;
	if (options?.cache && transformCache.has(cacheKey)) {
		jsCode = transformCache.get(cacheKey)!;
	} else {
		jsCode = transpiler.transformSync(transformedCode);
		if (options?.cache) {
			transformCache.set(cacheKey, jsCode);
		}
	}

	const relativePath = filePath.slice(filePath.lastIndexOf("/src/"));
	const outputPath = join(outputDir, relativePath.replace(/\.ts$/, ".mjs"));

	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, jsCode);

	// Dynamic import with cache busting
	const moduleUrl = `file://${outputPath}?t=${Date.now()}`;
	return await import(moduleUrl);
};

/**
 * Cleanup for tests - clears the transform cache
 */
export const clearTransformCache = () => {
	transformCache.clear();
};
