import { defineConfig } from "rspress/config";
import path from "node:path";

export default defineConfig({
  root: path.join(__dirname, "docs"),
  base: "/",
  title: "soda-gql",
  description:
    "Zero-runtime GraphQL query generation - Type-safe GraphQL with build-time transformation",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "API Reference", link: "/api/" },
      { text: "Recipes", link: "/recipes/" },
    ],
  },
});
