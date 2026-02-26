import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [
    "./src/graphql/verify-tagged-templates.ts",
    "./src/graphql/*-verification.ts",
    "./src/graphql/*-test.ts",
    "./src/graphql/callback-builder-features.ts",
  ],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: { scalars: "./scalars.ts" },
    },
  },
});
