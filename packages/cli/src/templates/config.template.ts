export const getConfigTemplate = (): string => `\
import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  outdir: "./graphql-system",
  include: ["./src/**/*.ts"],
  schemas: {
    default: {
      schema: "./schema.graphql",
      inject: "./graphql-system/default.inject.ts",
    },
  },
});
`;
