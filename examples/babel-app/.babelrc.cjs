module.exports = {
  presets: [["@babel/preset-typescript", { onlyRemoveTypeImports: true }]],
  plugins: [
    [
      require.resolve("@soda-gql/plugin-babel"),
      {
        configPath: "./soda-gql.config.ts",
      },
    ],
  ],
};
