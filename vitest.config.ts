import { defineConfig } from "vitest/config";

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
	},
});
