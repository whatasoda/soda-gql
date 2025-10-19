import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  graphqlSystemPath: "./graphql-system/index.cjs",
  builder: {
    entry: ["./src/**/*.ts"],
    outDir: ".cache/soda-gql",
    analyzer: "ts",
  },
});
