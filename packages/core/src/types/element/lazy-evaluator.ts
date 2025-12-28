/**
 * Context passed to the definition factory during evaluation.
 */
export type LazyEvaluatorContext = {
  canonicalId: string;
};

/**
 * Factory function that produces the definition value.
 * Can be sync or async.
 */
export type LazyDefinitionFactory<T> = (context: LazyEvaluatorContext | null) => T | Promise<T>;

/**
 * Function that provides dependencies to evaluate before the main definition.
 */
export type LazyDependencyProvider<TDep> = () => TDep[];

/**
 * Internal generator that handles the evaluation protocol.
 */
export type LazyEvaluatorExecutor<T> = (context: LazyEvaluatorContext | null) => Generator<Promise<void>, T, void>;

/**
 * Creates a lazy evaluator with caching, async support, and dependency ordering.
 *
 * @param define - Factory function that produces the value
 * @param getDeps - Optional function returning dependencies to evaluate first
 * @param createDepGenerator - Function to create evaluation generator for a dependency
 * @returns An executor generator function
 */
export const createLazyEvaluator = <T, TDep>(
  define: LazyDefinitionFactory<T>,
  getDeps: LazyDependencyProvider<TDep> | undefined,
  createDepGenerator: (dep: TDep) => Generator<Promise<void>, void, void>,
): LazyEvaluatorExecutor<T> => {
  let cache: { value: T } | null = null;
  let promise: Promise<void> | null = null;

  return function* execute(context: LazyEvaluatorContext | null): Generator<Promise<void>, T, void> {
    if (cache) {
      return cache.value;
    }

    if (promise) {
      yield promise;
      // biome-ignore lint/style/noNonNullAssertion: cache is guaranteed to be set after promise resolves
      return cache!.value;
    }

    if (getDeps) {
      // Need to evaluate the dependencies before the current element is evaluated.
      //
      // When dependencies is evaluated while the current element is being evaluated,
      // the evaluation method will be synchronous regardless of how the current builder
      // performs. If the dependencies need to be evaluated asynchronously, they throw an error.
      for (const dep of getDeps()) {
        yield* createDepGenerator(dep);
      }
    }

    const defined = define(context);
    if (!(defined instanceof Promise)) {
      return (cache = { value: defined }).value;
    }

    // Create a promise to resolve the value of the element asynchronously.
    // Yield the promise to make the builder process handle the asynchronous operation if it supports it.
    promise = defined.then((value) => {
      cache = { value };
      promise = null;
    });

    yield promise;
    // biome-ignore lint/style/noNonNullAssertion: cache is guaranteed to be set after promise resolves
    return cache!.value;
  };
};

/**
 * Creates an evaluation generator from an executor.
 * Wraps the executor's generator and discards its return value.
 */
export function* createEvaluationGenerator<T>(
  executor: LazyEvaluatorExecutor<T>,
  context: LazyEvaluatorContext | null,
): Generator<Promise<void>, void, void> {
  yield* executor(context);
}

/**
 * Executes the evaluator synchronously.
 * Throws if async operation is encountered.
 */
export const evaluateSync = <T>(executor: LazyEvaluatorExecutor<T>, context: LazyEvaluatorContext | null): T => {
  const result = executor(context).next();

  if (!result.done) {
    throw new Error("Async operation is not supported in sync evaluation.");
  }

  return result.value;
};
