const { SodaGqlWebpackPlugin } = require("@soda-gql/plugin-nestjs/webpack/plugin");

module.exports = (options, _webpack) => {
  return {
    ...options,
    ignoreWarnings: [
      ...(options.ignoreWarnings || []),
      (warning) => {
        // Ignore esbuild require.resolve warnings from node_modules
        // Check both warning.message and warning.details for the actual message
        const message = warning.message || warning.details || "";
        const modulePath = warning.module?.resource || warning.module?.identifier || "";

        const shouldIgnore =
          modulePath.includes("node_modules/esbuild") && (message.includes("require.resolve") || message.includes("esbuild"));

        return shouldIgnore;
      },
    ],
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
  };
};
