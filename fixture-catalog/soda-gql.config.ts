import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  // Include actual playground source files and test fixtures
  include: [
    // Playground source files
    "../src/**/*.{ts,tsx}",
    // Core valid fixtures (excludes formatting fixtures which have duplicate operation names)
    "./fixtures/core/valid/**/*.ts",
    // Duplicates of GetUser (keep sample.ts)
    "!./fixtures/**/attach-chaining.ts",
    "!./fixtures/**/basic-spread.ts",
    // Fragment-in-fragment uses Fragment Arguments that the template scanner can't extract
    "!./fixtures/**/fragment-in-fragment.ts",
    "!./fixtures/**/operations.ts",
    // Duplicates of ProfilePageQuery (keep top-level-definitions.ts)
    "!./fixtures/**/imported-binding-refs.ts",
    "!./fixtures/**/imported-slice-refs.ts",
    "!./fixtures/**/namespace-imports.ts",
    "!./fixtures/**/nested-namespace-deps.ts",
    "!./fixtures/**/top-level-with-metadata.ts",
    // Duplicate UpdateTask mutation (conflicts with playground src)
    "!./fixtures/**/nested-create.ts",
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
