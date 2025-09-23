import type { GraphqlAdapter } from "./adapter";
import type { SliceResult } from "./slice-result";
import type { ApplyTypeModifier } from "./type-modifier";
import type { DefaultValue, InputTypeRef } from "./type-ref";
import type { Hidden, Prettify } from "./utility";

declare const __VARIABLE_REFERENCE_BRAND__: unique symbol;

type VariableReferenceInput<TRef extends InputTypeRef> = Prettify<{
  kind: TRef["kind"];
  name: TRef["name"];
  modifier: ApplyTypeModifier<TRef["modifier"], "_"> | (TRef["defaultValue"] extends DefaultValue ? null | undefined : never);
}>;

type AnyVariableReferenceInfo = {
  kind: string;
  name: string;
  modifier: unknown;
};

export type VariableReferenceOf<TRef extends InputTypeRef> = VariableReference<VariableReferenceInput<TRef>>;

/** Nominal reference used to defer variable binding while carrying type info. */
export class VariableReference<TInput extends AnyVariableReferenceInfo> {
  declare readonly [__VARIABLE_REFERENCE_BRAND__]: Hidden<TInput>;

  private constructor(public readonly name: string) {}

  static create<TRef extends InputTypeRef>(ref: TRef): VariableReferenceOf<TRef> {
    return new VariableReference<VariableReferenceInput<TRef>>(ref.name);
  }
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
