import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import webpack from "webpack";
import type { Compiler, Stats } from "webpack";
import { SodaGqlWebpackPlugin } from "@soda-gql/plugin-nestjs/webpack/plugin";

describe("SodaGqlWebpackPlugin", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = join(tmpdir(), `soda-gql-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(tmpDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	const runCompiler = (compiler: Compiler): Promise<Stats> => {
		return new Promise((resolve, reject) => {
			compiler.run((err, stats) => {
				if (err) {
					reject(err);
				} else if (!stats) {
					reject(new Error("No stats returned"));
				} else {
					resolve(stats);
				}
			});
		});
	};

	describe("Artifact-file mode", () => {
		test("registers artifact as file dependency", async () => {
			const artifactPath = join(tmpDir, "artifact.json");
			const entryPath = join(tmpDir, "entry.js");

			// Create minimal artifact file
			await writeFile(
				artifactPath,
				JSON.stringify({
					version: "0.1.0",
					elements: {},
					report: { timestamp: Date.now(), durationMs: 0, warnings: [] },
				}),
				"utf8",
			);

			// Create minimal entry file
			await writeFile(entryPath, "export const foo = 'bar';", "utf8");

			const compiler = webpack({
				mode: "development",
				context: tmpDir,
				entry: entryPath,
				output: {
					path: join(tmpDir, "dist"),
					filename: "bundle.js",
				},
				plugins: [
					new SodaGqlWebpackPlugin({
						mode: "runtime",
						artifactPath,
						artifactSource: { source: "artifact-file", path: artifactPath },
					}),
				],
			});

			const stats = await runCompiler(compiler);

			expect(stats.hasErrors()).toBe(false);
			expect(stats.compilation.fileDependencies.has(artifactPath)).toBe(true);
		});

		test("emits diagnostics JSON asset when diagnostics mode is json", async () => {
			const artifactPath = join(tmpDir, "artifact.json");
			const entryPath = join(tmpDir, "entry.js");

			await writeFile(
				artifactPath,
				JSON.stringify({
					version: "0.1.0",
					elements: {},
					report: { timestamp: Date.now(), durationMs: 0, warnings: [] },
				}),
				"utf8",
			);

			await writeFile(entryPath, "export const foo = 'bar';", "utf8");

			const compiler = webpack({
				mode: "development",
				context: tmpDir,
				entry: entryPath,
				output: {
					path: join(tmpDir, "dist"),
					filename: "bundle.js",
				},
				plugins: [
					new SodaGqlWebpackPlugin({
						mode: "runtime",
						diagnostics: "json",
						artifactPath,
						artifactSource: { source: "artifact-file", path: artifactPath },
					}),
				],
			});

			const stats = await runCompiler(compiler);

			expect(stats.hasErrors()).toBe(false);
			expect(stats.compilation.assets["soda-gql.diagnostics.json"]).toBeDefined();
		});
	});

	describe("Error handling", () => {
		test("adds compilation error when artifact file is missing and bailOnError is true", async () => {
			const artifactPath = join(tmpDir, "missing-artifact.json");
			const entryPath = join(tmpDir, "entry.js");

			await writeFile(entryPath, "export const foo = 'bar';", "utf8");

			const compiler = webpack({
				mode: "development",
				context: tmpDir,
				entry: entryPath,
				output: {
					path: join(tmpDir, "dist"),
					filename: "bundle.js",
				},
				plugins: [
					new SodaGqlWebpackPlugin({
						mode: "zero-runtime",
						bailOnError: true,
						artifactPath,
						artifactSource: { source: "artifact-file", path: artifactPath },
					}),
				],
			});

			const stats = await runCompiler(compiler);

			// Should have errors due to missing artifact
			expect(stats.compilation.errors.length).toBeGreaterThan(0);
		});
	});

	describe("Plugin instantiation", () => {
		test("can be instantiated with minimal options", () => {
			const plugin = new SodaGqlWebpackPlugin({
				mode: "runtime",
			});

			expect(plugin).toBeDefined();
		});

		test("can be instantiated with full options", () => {
			const plugin = new SodaGqlWebpackPlugin({
				mode: "zero-runtime",
				artifactPath: "/tmp/artifact.json",
				artifactSource: { source: "artifact-file", path: "/tmp/artifact.json" },
				diagnostics: "json",
				bailOnError: true,
			});

			expect(plugin).toBeDefined();
		});
	});
});
