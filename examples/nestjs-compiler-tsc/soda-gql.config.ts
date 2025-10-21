import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  graphqlSystemPath: "./graphql-system/index.ts",
  graphqlSystemAlias: "@/graphql-system",
  builder: {
    entry: ["./src/**/*.ts"],
    outDir: ".cache/soda-gql",
    analyzer: "ts",
  },
  codegen: {
    output: "./graphql-system/index.ts",
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
  },
});
