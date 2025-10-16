import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  graphqlSystemPath: "./graphql-system/index.ts",
  builder: {
    entry: ["./src/**/*.ts"],
    outDir: ".cache/soda-gql",
    analyzer: "ts",
  },
});
