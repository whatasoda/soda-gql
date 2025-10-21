const path = require("node:path");
const { SodaGqlWebpackPlugin } = require("@soda-gql/plugin-webpack/plugin");

module.exports = (options, _webpack) => {
  const sodaOptions = {
    configPath: path.resolve(__dirname, "soda-gql.config.ts"),
  };

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
              loader: "@soda-gql/plugin-webpack/loader",
              options: sodaOptions,
            },
          ],
        },
      ],
    },
    plugins: [
      ...options.plugins,
      new SodaGqlWebpackPlugin({
        ...sodaOptions,
        diagnostics: process.env.NODE_ENV === "production" ? "json" : "console",
      }),
    ],
  };
};
