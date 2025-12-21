export default {
  plugins: [
    [
      "@soda-gql/babel-plugin",
      {
        mode: "runtime",
        artifactsPath: "./.cache/soda-gql/runtime.json",
      },
    ],
  ],
};
