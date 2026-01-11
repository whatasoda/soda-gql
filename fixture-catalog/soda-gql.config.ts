import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  // Only include core valid fixtures (excludes formatting fixtures which have duplicate operation names)
  include: ["./fixtures/core/valid/**/*.ts"],
  // Exclude fixtures with duplicate operation names (keep sample.ts, top-level-definitions.ts as representatives)
  exclude: [
    // Duplicates of GetUser (keep sample.ts)
    "./fixtures/**/attach-chaining.ts",
    "./fixtures/**/basic-spread.ts",
    "./fixtures/**/operations.ts",
    // Duplicates of ProfilePageQuery (keep top-level-definitions.ts)
    "./fixtures/**/imported-binding-refs.ts",
    "./fixtures/**/imported-slice-refs.ts",
    "./fixtures/**/namespace-imports.ts",
    "./fixtures/**/nested-namespace-deps.ts",
    "./fixtures/**/top-level-with-metadata.ts",
  ],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schemas/default/schema.graphql",
      inject: { scalars: "./schemas/default/scalars.ts" },
    },
    admin: {
      schema: "./schemas/admin/schema.graphql",
      inject: { scalars: "./schemas/admin/scalars.ts" },
    },
  },
});
