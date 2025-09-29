import type { AnyOperationSlice, AnyOperationSlices } from "@soda-gql/core/types/operation";
import type { AnyGraphqlSchema } from "@soda-gql/core/types/schema";
import type { GraphqlRuntimeAdapter } from "@soda-gql/core/types/adapter";
import type { OperationRoots } from "@soda-gql/core/types/operation-roots";
import type { ExecutionResultProjection } from "@soda-gql/core/types/execution-result-projection";

/**
 * Helper to create a minimal AnyOperationSlice for testing
 */
export function createTestOperationSlice<
  TAdapter extends GraphqlRuntimeAdapter,
  TPath extends string,
  TResult,
>(
  projection: ExecutionResultProjection<TAdapter, TPath, TResult>,
): AnyOperationSlice<AnyGraphqlSchema, TAdapter, keyof OperationRoots> {
  return {
    projection,
    _metadata: {} as any,
    _output: {} as any,
    variables: {},
    getFields: () => ({} as any),
  };
}

/**
 * Helper to create AnyOperationSlices for testing
 */
export function createTestOperationSlices<
  TAdapter extends GraphqlRuntimeAdapter,
  TSlices extends Record<string, ExecutionResultProjection<TAdapter, any, any>>,
>(
  projections: TSlices,
): AnyOperationSlices<AnyGraphqlSchema, TAdapter, keyof OperationRoots> {
  const result: any = {};

  for (const [key, projection] of Object.entries(projections)) {
    result[key] = createTestOperationSlice(projection);
  }

  return result;
}