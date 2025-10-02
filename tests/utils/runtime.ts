import type { AnySliceContent, AnySliceContents, SliceContent } from "../../packages/core/src/types/operation/slice";
import type { Projection } from "../../packages/core/src/types/runtime/projection";
import type { AnyGraphqlRuntimeAdapter } from "../../packages/core/src/types/runtime/runtime-adapter";
import type { AnyGraphqlSchema, OperationRoots } from "../../packages/core/src/types/schema";

type OperationKeys<TSchema extends AnyGraphqlSchema> = keyof TSchema["operations"] & string;
type EmptyRecord<TKey extends string> = Partial<Record<TKey, never>>;
type AdapterTag<TRuntime extends AnyGraphqlRuntimeAdapter> = {
  readonly __adapterType?: ReturnType<TRuntime["nonGraphqlErrorType"]>;
};

export function createTestSlice<
  TSchema extends AnyGraphqlSchema = AnyGraphqlSchema,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter = AnyGraphqlRuntimeAdapter,
  TResult = unknown,
>(
  projection: Projection<TResult>,
): SliceContent<
  EmptyRecord<OperationKeys<TSchema>>,
  EmptyRecord<keyof OperationRoots & string> & AdapterTag<TRuntimeAdapter>,
  Projection<TResult>
> {
  return {
    projection,
    variables: {} as EmptyRecord<OperationKeys<TSchema>>,
    getFields: () => ({}) as EmptyRecord<keyof OperationRoots & string> & AdapterTag<TRuntimeAdapter>,
  };
}

export function createTestSlices<
  TSchema extends AnyGraphqlSchema = AnyGraphqlSchema,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter = AnyGraphqlRuntimeAdapter,
  TSlices extends Record<string, Projection<any>> = Record<string, Projection<any>>,
>(projections: TSlices): AnySliceContents {
  const fragments: AnySliceContents = {};

  for (const [key, projection] of Object.entries(projections)) {
    fragments[key] = createTestSlice<TSchema, TRuntimeAdapter>(projection) as AnySliceContent;
  }

  return fragments;
}
