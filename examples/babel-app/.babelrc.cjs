module.exports = {
  presets: [["@babel/preset-typescript", { onlyRemoveTypeImports: true }]],
  plugins: [
    [
      require.resolve("@soda-gql/babel-plugin"),
      {
        configPath: "./soda-gql.config.ts",
      },
    ],
  ],
};
