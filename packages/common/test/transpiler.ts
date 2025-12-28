import * as esbuild from "esbuild";

/**
 * Transpile TypeScript code to JavaScript using esbuild.
 * Replacement for Bun.Transpiler in test environments.
 */
export const transpileTypeScript = (code: string): string => {
	const result = esbuild.transformSync(code, {
		loader: "ts",
		target: "esnext",
		format: "esm",
	});
	return result.code;
};
