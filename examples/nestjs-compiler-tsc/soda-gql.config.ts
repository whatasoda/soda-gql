import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  graphqlSystemAliases: ["@/graphql-system"],
  include: ["./src/**/*.ts"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schema.graphql",
      runtimeAdapter: "./inject-module/runtime-adapter.ts",
      scalars: "./inject-module/scalar.ts",
    },

    default2: {
      schema: "./schema.graphql",
      runtimeAdapter: "./inject-module/runtime-adapter.ts",
      scalars: "./inject-module/scalar.ts",
    },
  },
});
