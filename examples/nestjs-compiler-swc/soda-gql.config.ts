import { defineConfig } from '@soda-gql/config';

export default defineConfig({
  schema: './schema.graphql',
  output: './graphql-system/index.ts',
});
