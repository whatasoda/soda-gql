import { resolve } from "node:path";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sodaGqlPlugin({ debug: true }), react()],
  resolve: {
    alias: [
      { find: "@/graphql-system", replacement: resolve(__dirname, "./fixture-catalog/graphql-system") },
      { find: "@", replacement: resolve(__dirname, "./src") },
    ],
  },
});
