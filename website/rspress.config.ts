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
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is soda-gql?", link: "/guide/" },
            { text: "Getting Started", link: "/guide/getting-started" },
          ],
        },
      ],
    },
  },
});
