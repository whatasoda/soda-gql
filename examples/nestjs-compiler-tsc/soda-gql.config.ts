import { defineConfig } from "@soda-gql/config";

export default defineConfig({
  graphqlSystemPath: "./graphql-system/index.ts",
  graphqlSystemAlias: "@/graphql-system",
  builder: {
    entry: ["./src/**/*.ts"],
    outDir: ".cache/soda-gql",
    analyzer: "ts",
  },
});
