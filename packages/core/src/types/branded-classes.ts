import type { GraphqlAdapter } from "./adapter";
import type { AnyGraphqlSchema, InferInputDefinitionType } from "./schema";
import type { SliceResult } from "./slice-result";
import type { InputDefinition } from "./type-ref";
import type { Hidden } from "./utility";

declare const __VARIABLE_REFERENCE_BRAND__: unique symbol;

/** Nominal reference used to defer variable binding while carrying type info. */
export class VariableReference<TSchema extends AnyGraphqlSchema, TRef extends InputDefinition> {
  declare readonly [__VARIABLE_REFERENCE_BRAND__]: Hidden<{
    type: InferInputDefinitionType<TSchema, TRef>;
    kind: TRef["kind"];
    name: TRef["name"];
  }>;

  constructor(public readonly name: string) {}
}

declare const __SLICE_RESULT_SELECTION_BRAND__: unique symbol;

/**
 * Nominal type representing any slice selection regardless of schema specifics.
 * Encodes how individual slices map a concrete field path to a projection
 * function. Multiple selections allow slices to expose several derived values.
 */
export class SliceResultSelection<TAdapter extends GraphqlAdapter, TPath extends string, TData, TTransformed> {
  declare readonly [__SLICE_RESULT_SELECTION_BRAND__]: Hidden<never>;

  constructor(
    public readonly path: TPath,
    public readonly projector: (result: SliceResult<TData, TAdapter>) => TTransformed,
  ) {}
}
