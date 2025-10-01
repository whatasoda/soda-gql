import type {
  AnyOperationSliceFragment,
  AnyOperationSliceFragments,
  OperationSliceFragment,
} from "../../packages/core/src/types/operation/operation-slice";
import type { ExecutionResultProjection } from "../../packages/core/src/types/runtime/execution-result-projection";
import type { AnyGraphqlRuntimeAdapter } from "../../packages/core/src/types/runtime/runtime-adapter";
import type { AnyGraphqlSchema, OperationRoots } from "../../packages/core/src/types/schema";

type OperationKeys<TSchema extends AnyGraphqlSchema> = keyof TSchema["operations"] & string;
type EmptyRecord<TKey extends string> = Partial<Record<TKey, never>>;
type AdapterTag<TRuntime extends AnyGraphqlRuntimeAdapter> = {
  readonly __adapterType?: ReturnType<TRuntime["nonGraphqlErrorType"]>;
};

export function createTestOperationSlice<
  TSchema extends AnyGraphqlSchema = AnyGraphqlSchema,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter = AnyGraphqlRuntimeAdapter,
  TResult = unknown,
>(
  projection: ExecutionResultProjection<TResult>,
): OperationSliceFragment<
  EmptyRecord<OperationKeys<TSchema>>,
  EmptyRecord<keyof OperationRoots & string> & AdapterTag<TRuntimeAdapter>,
  ExecutionResultProjection<TResult>
> {
  return {
    projection,
    variables: {} as EmptyRecord<OperationKeys<TSchema>>,
    getFields: () => ({}) as EmptyRecord<keyof OperationRoots & string> & AdapterTag<TRuntimeAdapter>,
  };
}

export function createTestOperationSlices<
  TSchema extends AnyGraphqlSchema = AnyGraphqlSchema,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter = AnyGraphqlRuntimeAdapter,
  TSlices extends Record<string, ExecutionResultProjection<any>> = Record<string, ExecutionResultProjection<any>>,
>(projections: TSlices): AnyOperationSliceFragments {
  const fragments: AnyOperationSliceFragments = {};

  for (const [key, projection] of Object.entries(projections)) {
    fragments[key] = createTestOperationSlice<TSchema, TRuntimeAdapter>(projection) as AnyOperationSliceFragment;
  }

  return fragments;
}
