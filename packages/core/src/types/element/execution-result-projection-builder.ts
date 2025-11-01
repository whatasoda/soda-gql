import type { Tuple } from "../../utils/type-utils";
import type { AnyFields, AvailableFieldPathOf, InferByFieldPath } from "../fragment";
import type { SodaGqlSchemaRegistry } from "../registry";
import type { AnyGraphqlRuntimeAdapter, AnyProjection, Projection, SlicedExecutionResult } from "../runtime";

export type AnyExecutionResultProjectionsBuilder = ExecutionResultProjectionsBuilder<
  keyof SodaGqlSchemaRegistry extends never ? string : keyof SodaGqlSchemaRegistry,
  AnyGraphqlRuntimeAdapter,
  any,
  any
>;

export type ExecutionResultProjectionsBuilder<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
  TFields extends AnyFields,
  TProjection extends AnyProjection,
> = (tools: { select: ResultSelector<TSchemaKey, TRuntimeAdapter, TFields> }) => TProjection;

type ResultSelector<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
  TFields extends AnyFields,
> = <TPaths extends Tuple<AvailableFieldPathOf<TSchemaKey, TFields>>, TProjected>(
  paths: TPaths,
  projector: (
    result: NoInfer<SlicedExecutionResult<InferByResultSelectorPaths<TSchemaKey, TFields, TPaths>, TRuntimeAdapter>>,
  ) => TProjected,
) => NoInfer<Projection<TProjected>>;

type InferByResultSelectorPaths<
  TSchemaKey extends keyof SodaGqlSchemaRegistry,
  TFields extends AnyFields,
  TPaths extends Tuple<AvailableFieldPathOf<TSchemaKey, TFields>>,
> = TPaths extends string[]
  ? {
      [K in keyof TPaths]: TPaths[K] extends string ? InferByFieldPath<TSchemaKey, TFields, TPaths[K]> : never;
    }
  : never;
