import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["../fixtures/**/*.ts"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schemas/default/schema.graphql",
      runtimeAdapter: "./schemas/default/runtime-adapter.ts",
      scalars: "./schemas/default/scalars.ts",
    },
    admin: {
      schema: "./schemas/admin/schema.graphql",
      runtimeAdapter: "./schemas/admin/runtime-adapter.ts",
      scalars: "./schemas/admin/scalars.ts",
    },
  },
});
