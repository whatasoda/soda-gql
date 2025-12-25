import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  graphqlSystemAliases: ["@/graphql-system"],
  include: ["./src/**/*.ts", "./src/**/*.tsx"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schema.graphql",
      scalars: "./inject-module/scalar.ts",
    },
  },
});
