const { SodaGqlWebpackPlugin } = require("@soda-gql/plugin-nestjs/webpack/plugin");

module.exports = (options, _webpack) => ({
  ...options,
  module: {
    ...options.module,
    rules: [
      ...(options.module?.rules ?? []),
      {
        test: /\.[jt]sx?$/,
        enforce: "pre", // Run before ts-loader to transform TypeScript directly
        exclude: /node_modules/,
        use: [
          {
            loader: "@soda-gql/plugin-nestjs/webpack/loader",
            options: {
              mode: "zero-runtime",
              artifactSource: {
                source: "artifact-file",
                path: ".cache/soda-gql-artifact.json",
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    ...options.plugins,
    new SodaGqlWebpackPlugin({
      mode: "zero-runtime",
      artifactSource: {
        source: "artifact-file",
        path: ".cache/soda-gql-artifact.json",
      },
    }),
  ],
});
