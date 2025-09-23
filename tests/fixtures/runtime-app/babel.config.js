export default {
  plugins: [
    [
      "@soda-gql/plugin-babel",
      {
        mode: "runtime",
        artifactsPath: "./.cache/soda-gql/runtime.json",
      },
    ],
  ],
};
