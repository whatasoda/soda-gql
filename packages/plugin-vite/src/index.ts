/**
 * @soda-gql/plugin-vite
 *
 * Vite plugin for soda-gql zero-runtime GraphQL transformations.
 *
 * @example
 * ```typescript
 * import { defineConfig } from 'vite';
 * import { sodaGqlVitePlugin } from '@soda-gql/plugin-vite';
 *
 * export default defineConfig({
 *   plugins: [
 *     sodaGqlVitePlugin({
 *       configPath: './soda-gql.config.ts'
 *     })
 *   ]
 * });
 * ```
 */

export { default, sodaGqlVitePlugin, type VitePluginOptions } from "./plugin";
