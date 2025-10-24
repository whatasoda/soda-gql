/**
 * @soda-gql/plugin-next
 *
 * Next.js integration for soda-gql zero-runtime GraphQL transformations.
 *
 * This package provides a convenient wrapper around @soda-gql/plugin-swc
 * for easy integration with Next.js applications.
 *
 * @example
 * ```typescript
 * // In next.config.js:
 * import { withSodaGql } from '@soda-gql/plugin-next';
 *
 * export default withSodaGql({
 *   // Your Next.js config
 * }, {
 *   // soda-gql options
 *   configPath: './soda-gql.config.ts'
 * });
 * ```
 */

import type { PluginOptions } from "@soda-gql/plugin-common";

/**
 * Next.js configuration type (simplified).
 * This matches the structure of Next.js config objects.
 */
export type NextConfig = {
  experimental?: {
    swcPlugins?: Array<[string, Record<string, unknown>]>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/**
 * Options for soda-gql Next.js integration.
 */
export type SodaGqlNextOptions = PluginOptions;

/**
 * Wrap a Next.js configuration with soda-gql SWC plugin.
 *
 * This function adds the @soda-gql/plugin-swc to the Next.js SWC plugin configuration.
 * It preserves any existing configuration and plugins.
 *
 * @param nextConfig - Your existing Next.js configuration object
 * @param sodaGqlOptions - Options to pass to the soda-gql plugin
 * @returns Modified Next.js configuration with soda-gql plugin
 *
 * @example
 * ```typescript
 * // next.config.js
 * import { withSodaGql } from '@soda-gql/plugin-next';
 *
 * export default withSodaGql({
 *   reactStrictMode: true,
 *   // ... other Next.js options
 * }, {
 *   configPath: './soda-gql.config.ts'
 * });
 * ```
 *
 * @example With existing SWC plugins
 * ```typescript
 * import { withSodaGql } from '@soda-gql/plugin-next';
 *
 * export default withSodaGql({
 *   experimental: {
 *     swcPlugins: [
 *       ['@swc/plugin-styled-components', {}]
 *     ]
 *   }
 * }, {
 *   configPath: './soda-gql.config.ts'
 * });
 * ```
 */
export function withSodaGql(
  nextConfig: NextConfig = {},
  sodaGqlOptions: SodaGqlNextOptions = {},
): NextConfig {
  return {
    ...nextConfig,
    experimental: {
      ...nextConfig.experimental,
      swcPlugins: [
        // Add soda-gql plugin
        ["@soda-gql/plugin-swc", sodaGqlOptions],
        // Preserve existing plugins
        ...(nextConfig.experimental?.swcPlugins || []),
      ],
    },
  };
}

/**
 * Default export for convenience.
 */
export default withSodaGql;
