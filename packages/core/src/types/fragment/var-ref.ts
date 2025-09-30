import type { ApplyTypeModifier } from "../schema/type-modifier";
import type { AnyDefaultValue, InputTypeRef } from "../schema/type-ref";
import type { Prettify } from "../shared/prettify";
import type { Hidden } from "../shared/hidden";

/** Nominal reference placeholder used inside `AnyVariableAssignments`. */
export type AnyVarRef = VarRef<any>;

type AnyVarRefMeta = {
  kind: string;
  name: string;
  modifier: unknown;
};

export type VarRefBy<TRef extends InputTypeRef> = VarRef<VarRefMetaBy<TRef>>;
type VarRefMetaBy<TRef extends InputTypeRef> = Prettify<{
  kind: TRef["kind"];
  name: TRef["name"];
  modifier: ApplyTypeModifier<TRef["modifier"], "_"> | (TRef["defaultValue"] extends AnyDefaultValue ? null | undefined : never);
}>;

declare const __VAR_REF_BRAND__: unique symbol;
/** Nominal reference used to defer variable binding while carrying type info. */
export class VarRef<TMeta extends AnyVarRefMeta> {
  declare readonly [__VAR_REF_BRAND__]: Hidden<TMeta>;

  private constructor(public readonly name: string) {}

  static create<TRef extends InputTypeRef>(name: string): VarRefBy<TRef> {
    return new VarRef<VarRefMetaBy<TRef>>(name);
  }
}
