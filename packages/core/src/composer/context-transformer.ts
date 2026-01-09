/**
 * Context transformer for programmatic API.
 * Allows external tools to transform the composer context before it's passed to the callback.
 * @module
 */

/**
 * Function type for transforming composer context.
 * Receives the context object and returns a transformed version.
 */
export type ContextTransformer = (context: Record<string, unknown>) => Record<string, unknown>;

let currentTransformer: ContextTransformer | null = null;

/**
 * Sets the context transformer to be applied when creating GQL element composers.
 * This is intended for use by @soda-gql/sdk and similar programmatic APIs.
 */
export const setContextTransformer = (transformer: ContextTransformer): void => {
  currentTransformer = transformer;
};

/**
 * Gets the currently set context transformer, if any.
 */
export const getContextTransformer = (): ContextTransformer | null => {
  return currentTransformer;
};

/**
 * Clears the context transformer.
 * Should be called after build operations complete to avoid leaking state.
 */
export const clearContextTransformer = (): void => {
  currentTransformer = null;
};

/**
 * Applies the current context transformer to a context object.
 * Returns the original context if no transformer is set.
 */
export const applyContextTransformer = <T extends Record<string, unknown>>(context: T): T => {
  if (currentTransformer === null) {
    return context;
  }
  return currentTransformer(context) as T;
};
