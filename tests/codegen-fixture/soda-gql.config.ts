import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["../fixtures/**/*.ts"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schemas/default/schema.graphql",
      scalars: "./schemas/default/scalars.ts",
    },
    admin: {
      schema: "./schemas/admin/schema.graphql",
      scalars: "./schemas/admin/scalars.ts",
    },
  },
});
