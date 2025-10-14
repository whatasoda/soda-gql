import { SodaGqlWebpackPlugin } from '@soda-gql/plugin-nestjs/webpack/plugin';

export default function (options, webpack) {
  return {
    ...options,
    plugins: [
      ...options.plugins,
      new SodaGqlWebpackPlugin({
        mode: 'artifact-file',
        artifactPath: '.cache/soda-gql-artifact.json',
      }),
    ],
  };
}
