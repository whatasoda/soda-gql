const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { SodaGqlWebpackPlugin } = require("@soda-gql/webpack-plugin");

module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "@/graphql-system": path.resolve(__dirname, "./graphql-system"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          "ts-loader",
          {
            loader: "@soda-gql/webpack-plugin/loader",
            options: {
              configPath: "./soda-gql.config.ts",
              transformer: "swc",
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new SodaGqlWebpackPlugin({
      configPath: "./soda-gql.config.ts",
      debug: true,
      transformer: "swc",
    }),
    new HtmlWebpackPlugin({
      template: "./src/index.html",
    }),
  ],
  devServer: {
    static: "./dist",
    hot: true,
    port: 3000,
  },
};
