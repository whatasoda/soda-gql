/**
 * Helper function for defining typed helpers with better inference.
 * Use this when you need explicit typing or when type inference needs assistance.
 *
 * @example
 * ```typescript
 * const gql = createGqlElementComposer(schema, {
 *   helpers: defineHelpers({
 *     auth: {
 *       requiresLogin: () => ({ requiresAuth: true }),
 *       adminOnly: () => ({ requiresAuth: true, role: 'admin' }),
 *     },
 *   }),
 * });
 * ```
 */
export const defineHelpers = <T extends object>(helpers: T): T => helpers;
