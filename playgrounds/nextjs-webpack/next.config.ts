import { SodaGqlWebpackPlugin } from "@soda-gql/webpack-plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    // Add soda-gql webpack plugin
    config.plugins.push(
      new SodaGqlWebpackPlugin({
        configPath: "./soda-gql.config.ts",
        debug: dev,
        transformer: "babel",
      }),
    );

    // Add soda-gql loader for TypeScript files
    config.module.rules.push({
      test: /\.tsx?$/,
      exclude: /node_modules/,
      use: [
        {
          loader: "@soda-gql/webpack-plugin/loader",
          options: {
            configPath: "./soda-gql.config.ts",
            transformer: "babel",
          },
        },
      ],
    });

    return config;
  },
};

export default nextConfig;
