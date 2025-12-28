import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	test: {
		include: [
			"packages/**/test/**/*.test.ts",
			"packages/**/src/**/*.test.ts",
		],
		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"**/.cache/**",
			"**/fixtures/**",
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov"],
			reportsDirectory: ".coverage",
			exclude: [
				"node_modules/**",
				"**/test/**",
				"**/dist/**",
				"**/.cache/**",
				"**/fixtures/**",
			],
		},
		testTimeout: 30000,
		environment: "node",
	},
	resolve: {
		conditions: ["@soda-gql"],
		alias: {
			"@soda-gql/common/test": resolve(__dirname, "packages/common/test/export.ts"),
			"@soda-gql/common/portable": resolve(__dirname, "packages/common/src/portable/index.ts"),
			"@soda-gql/common/canonical-id": resolve(__dirname, "packages/common/src/canonical-id/index.ts"),
			"@soda-gql/common/utils": resolve(__dirname, "packages/common/src/utils/index.ts"),
			"@soda-gql/common/zod": resolve(__dirname, "packages/common/src/zod/index.ts"),
			"@soda-gql/common": resolve(__dirname, "packages/common/src/index.ts"),
			"@soda-gql/config/test": resolve(__dirname, "packages/config/test/export.ts"),
			"@soda-gql/config": resolve(__dirname, "packages/config/src/index.ts"),
			"@soda-gql/core/runtime": resolve(__dirname, "packages/core/src/runtime/index.ts"),
			"@soda-gql/core": resolve(__dirname, "packages/core/src/index.ts"),
			"@soda-gql/builder": resolve(__dirname, "packages/builder/src/index.ts"),
			"@soda-gql/codegen": resolve(__dirname, "packages/codegen/src/index.ts"),
			"@soda-gql/tsc-transformer/test": resolve(__dirname, "packages/tsc-transformer/test/export.ts"),
			"@soda-gql/tsc-transformer": resolve(__dirname, "packages/tsc-transformer/src/index.ts"),
			"@soda-gql/babel-plugin": resolve(__dirname, "packages/babel-plugin/src/index.ts"),
			"@soda-gql/babel-transformer": resolve(__dirname, "packages/babel-transformer/src/index.ts"),
			"@soda-gql/swc-transformer": resolve(__dirname, "packages/swc-transformer/src/index.ts"),
			"@soda-gql/plugin-common": resolve(__dirname, "packages/plugin-common/src/index.ts"),
			"@soda-gql/formatter": resolve(__dirname, "packages/formatter/src/index.ts"),
			"@soda-gql/colocation-tools": resolve(__dirname, "packages/colocation-tools/src/index.ts"),
		},
	},
});
