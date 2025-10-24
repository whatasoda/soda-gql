/**
 * @soda-gql/plugin-webpack
 *
 * Webpack loader for soda-gql zero-runtime GraphQL transformations.
 *
 * This package provides a Webpack loader that integrates soda-gql into your build pipeline.
 * It's compatible with both standard Webpack 5 and Next.js Turbopack.
 *
 * @example
 * ```javascript
 * // webpack.config.js
 * module.exports = {
 *   module: {
 *     rules: [
 *       {
 *         test: /\.(ts|tsx|js|jsx)$/,
 *         exclude: /node_modules/,
 *         use: [
 *           {
 *             loader: '@soda-gql/plugin-webpack',
 *             options: {
 *               configPath: './soda-gql.config.ts'
 *             }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * };
 * ```
 *
 * @example Next.js with Webpack
 * ```javascript
 * // next.config.js
 * module.exports = {
 *   webpack: (config) => {
 *     config.module.rules.push({
 *       test: /\.(ts|tsx)$/,
 *       use: [{
 *         loader: '@soda-gql/plugin-webpack',
 *         options: { configPath: './soda-gql.config.ts' }
 *       }]
 *     });
 *     return config;
 *   }
 * };
 * ```
 *
 * @example Next.js with Turbopack
 * ```javascript
 * // next.config.js
 * module.exports = {
 *   turbopack: {
 *     rules: {
 *       '**.{ts,tsx}': {
 *         loaders: [{
 *           loader: '@soda-gql/plugin-webpack',
 *           options: { configPath: './soda-gql.config.ts' }
 *         }],
 *         as: '*.js',
 *       },
 *     },
 *   },
 * };
 * ```
 */

export { default } from "./loader.js";
export { default as sodaGqlLoader } from "./loader.js";
export type { WebpackLoaderOptions } from "./loader.js";
