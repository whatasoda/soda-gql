import type { AnyFields, AvailableFieldPathOf, InferByFieldPath } from "../fragment";
import type {
  AnyExecutionResultProjection,
  AnyGraphqlRuntimeAdapter,
  ExecutionResultProjection,
  SlicedExecutionResult,
} from "../runtime";
import type { AnyGraphqlSchema } from "../schema";
import type { Tuple } from "../shared/utility";

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
  TProjection extends AnyExecutionResultProjection,
> = (tools: { select: ResultSelector<TSchema, TRuntimeAdapter, TFields> }) => TProjection;

/** Helper passed to selection builders for choosing a field path and projector. */
type ResultSelector<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends AnyGraphqlRuntimeAdapter,
  TFields extends AnyFields,
> = <TPaths extends Tuple<AvailableFieldPathOf<TSchema, TFields>>, TProjected>(
  paths: TPaths,
  projector: (result: SlicedExecutionResult<InferByResultSelectorPaths<TSchema, TFields, TPaths>, TRuntimeAdapter>) => TProjected,
) => ExecutionResultProjection<TProjected>;

type InferByResultSelectorPaths<
  TSchema extends AnyGraphqlSchema,
  TFields extends AnyFields,
  TPaths extends Tuple<AvailableFieldPathOf<TSchema, TFields>>,
> = TPaths extends string[]
  ? {
      [K in keyof TPaths]: TPaths[K] extends string ? InferByFieldPath<TSchema, TFields, TPaths[K]> : never;
    }
  : never;
