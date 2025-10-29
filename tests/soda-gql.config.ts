import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./fixtures/runtime-app/graphql-system",
  include: ["./fixtures/runtime-app/src/**/*.ts"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./fixtures/runtime-app/schema.graphql",
      runtimeAdapter: "./fixtures/inject-module/default-runtime-adapter.ts",
      scalars: "./fixtures/inject-module/default-scalar.ts",
    },
  },
});
