import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["**/*.ts"],
  schemas: {
    default: {
      schema: "./schemas/default.graphql",
      inject: { scalars: "./scalars.ts" },
    },
  },
});
