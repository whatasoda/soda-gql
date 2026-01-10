import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["./fixtures/**/valid/**/*.ts"],
  analyzer: "ts",
  schemas: {
    default: {
      schema: "./schemas/default/schema.graphql",
      inject: { scalars: "./schemas/default/scalars.ts" },
    },
    admin: {
      schema: "./schemas/admin/schema.graphql",
      inject: { scalars: "./schemas/admin/scalars.ts" },
    },
  },
});
