import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["./fixtures/**/*.ts"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schemas/default-schema.graphql",
      runtimeAdapter: "./schemas/runtime-adapter.ts",
      scalars: "./schemas/scalars.ts",
    },
    admin: {
      schema: "./schemas/admin-schema.graphql",
      runtimeAdapter: "./schemas/runtime-adapter.ts",
      scalars: "./schemas/scalars.ts",
    },
  },
});
