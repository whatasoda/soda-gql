import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["./src/**/*.ts"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schema.graphql",
    },
  },
});
