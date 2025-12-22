import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sodaGqlPlugin } from "@soda-gql/vite-plugin";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [sodaGqlPlugin({ debug: true }), react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@/graphql-system": resolve(__dirname, "./graphql-system"),
    },
  },
});
