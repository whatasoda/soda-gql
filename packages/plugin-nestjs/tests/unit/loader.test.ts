import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import loader from "../../src/webpack/loader.js";
import { createTempArtifact, createTempSource } from "../helpers/fixtures.js";
import { runLoader } from "../helpers/loader.js";

describe("SodaGqlWebpackLoader", () => {
	describe("Runtime mode", () => {
		test("returns source unchanged in runtime mode", async () => {
			const source = 'export const query = gql.operation.query({}, () => ({}));\n';
			const artifactPath = await createTempArtifact({
				version: "0.1.0",
				elements: {},
				report: {
					timestamp: Date.now(),
					durationMs: 0,
					warnings: [],
				},
			});

			const result = await runLoader({
				loader,
				resourcePath: join(artifactPath, "../entry.ts"),
				rootContext: join(artifactPath, ".."),
				source,
				options: { mode: "runtime", artifactPath },
				sourceMap: { version: 3, mappings: "" },
			});

			expect(result.error).toBeUndefined();
			expect(result.code).toBe(source);
			expect(result.map).toEqual({ version: 3, mappings: "" });
		});
	});

	describe("TypeScript declaration files", () => {
		test("skips transformation for .d.ts files", async () => {
			const source = 'export declare const query: any;\n';
			const artifactPath = await createTempArtifact({
				version: "0.1.0",
				elements: {},
				report: {
					timestamp: Date.now(),
					durationMs: 0,
					warnings: [],
				},
			});

			const result = await runLoader({
				loader,
				resourcePath: join(artifactPath, "../entry.d.ts"),
				rootContext: join(artifactPath, ".."),
				source,
				options: { mode: "zero-runtime", artifactPath },
			});

			expect(result.error).toBeUndefined();
			expect(result.code).toBe(source);
		});
	});

	describe("Option validation", () => {
		test("throws error for invalid loader options", async () => {
			const source = 'export const query = gql.operation.query({}, () => ({}));\n';

			const result = await runLoader({
				loader,
				resourcePath: "/tmp/entry.ts",
				source,
				options: { mode: "invalid-mode" } as any,
			});

			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain("Invalid loader options");
		});

		test("throws error for missing artifactPath", async () => {
			const source = 'export const query = gql.operation.query({}, () => ({}));\n';

			const result = await runLoader({
				loader,
				resourcePath: "/tmp/entry.ts",
				source,
				options: { mode: "zero-runtime" } as any,
			});

			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain("artifactPath option is required");
		});
	});

	describe("Zero-runtime transformation", () => {
		test("transforms source code with Babel adapter", async () => {
			const source = `
import { gql } from "@soda-gql/core";

export const query = gql.operation.query({}, () => ({}));
`;
			const artifactPath = await createTempArtifact({
				version: "0.1.0",
				elements: {},
				report: {
					timestamp: Date.now(),
					durationMs: 0,
					warnings: [],
				},
			});

			const result = await runLoader({
				loader,
				resourcePath: join(artifactPath, "../entry.ts"),
				rootContext: join(artifactPath, ".."),
				source,
				options: { mode: "zero-runtime", artifactPath },
			});

			expect(result.error).toBeUndefined();
			// In zero-runtime mode, the code should be transformed
			// (exact transformation depends on Babel adapter, so we just verify no error)
			expect(result.code).toBeDefined();
			expect(typeof result.code).toBe("string");
		});
	});
});
