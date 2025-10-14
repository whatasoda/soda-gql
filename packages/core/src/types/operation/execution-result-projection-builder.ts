import type { Tuple } from "../../utils/type-utils";
import type { AnyFields, AvailableFieldPathOf, InferByFieldPath } from "../fragment";
import type { AnyGraphqlRuntimeAdapter, AnyProjection, Projection, SlicedExecutionResult } from "../runtime";
import type { AnyGraphqlSchema } from "../schema";

export type AnyExecutionResultProjectionsBuilder = ExecutionResultProjectionsBuilder<
  AnyGraphqlSchema,
  AnyGraphqlRuntimeAdapter,
  any,
  any
>;

/** Builder used to declare how slice results are projected. */
export type ExecutionResultProjectionsBuilder<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
  TFields extends AnyFields,
  TProjection extends AnyProjection,
> = (tools: { select: ResultSelector<TSchema, TRuntimeAdapter, TFields> }) => TProjection;

/** Helper passed to selection builders for choosing a field path and projector. */
type ResultSelector<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
  TFields extends AnyFields,
> = <TPaths extends Tuple<AvailableFieldPathOf<TSchema, TFields>>, TProjected>(
  paths: TPaths,
  projector: (
    result: NoInfer<SlicedExecutionResult<InferByResultSelectorPaths<TSchema, TFields, TPaths>, TRuntimeAdapter>>,
  ) => TProjected,
) => NoInfer<Projection<TProjected>>;

type InferByResultSelectorPaths<
  TSchema extends AnyGraphqlSchema,
  TFields extends AnyFields,
  TPaths extends Tuple<AvailableFieldPathOf<TSchema, TFields>>,
> = TPaths extends string[]
  ? {
      [K in keyof TPaths]: TPaths[K] extends string ? InferByFieldPath<TSchema, TFields, TPaths[K]> : never;
    }
  : never;
