import { defineConfig } from "rspress/config";
import path from "node:path";

export default defineConfig({
  root: path.join(__dirname, "docs"),
  base: "/",
  title: "soda-gql",
  description:
    "Zero-runtime GraphQL query generation - Type-safe GraphQL with build-time transformation",
  markdown: {
    showLineNumbers: true,
  },
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/whatasoda/soda-gql",
      },
    ],
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
        {
          text: "Core Concepts",
          items: [
            { text: "Fragments", link: "/guide/fragments" },
            { text: "Operations", link: "/guide/operations" },
            { text: "Variables", link: "/guide/variables" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Metadata", link: "/guide/metadata" },
            { text: "Fragment Colocation", link: "/guide/colocation" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [{ text: "Overview", link: "/api/" }],
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
          items: [{ text: "Examples Overview", link: "/recipes/" }],
        },
      ],
    },
    footer: {
      message: "Released under the MIT License.",
    },
    lastUpdated: true,
    outline: {
      level: [2, 3],
    },
  },
});
