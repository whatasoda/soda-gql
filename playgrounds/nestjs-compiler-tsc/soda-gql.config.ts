import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./src/graphql-system",
  include: ["./src/**/*.ts"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: { scalars: "./scalars.ts" },
    },
  },
});
