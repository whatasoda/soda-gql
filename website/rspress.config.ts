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
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/" },
          ],
        },
        {
          text: "Packages",
          items: [
            { text: "@soda-gql/core", link: "/api/packages/core" },
            { text: "@soda-gql/cli", link: "/api/packages/cli" },
          ],
        },
      ],
      "/recipes/": [
        {
          text: "Recipes",
          items: [
            { text: "Examples Overview", link: "/recipes/" },
          ],
        },
      ],
    },
  },
});
