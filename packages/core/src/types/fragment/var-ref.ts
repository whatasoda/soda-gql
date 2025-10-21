import type { Hidden } from "../../utils/hidden";
import type { Prettify } from "../../utils/prettify";
import type { ApplyTypeModifier } from "../schema/type-modifier";
import type { AnyDefaultValue, InputTypeSpecifier } from "../schema/type-specifier";

/** Nominal reference placeholder used inside `AnyVariableAssignments`. */
export type AnyVarRef = VarRef<any>;

type AnyVarRefMeta = {
  readonly kind: string;
  readonly name: string;
  readonly modifier: unknown;
};

export type VarRefBy<TRef extends InputTypeSpecifier> = VarRef<VarRefMetaBy<TRef>>;
type VarRefMetaBy<TRef extends InputTypeSpecifier> = Prettify<{
  readonly kind: TRef["kind"];
  readonly name: TRef["name"];
  readonly modifier:
    | ApplyTypeModifier<TRef["modifier"], "_">
    | (TRef["defaultValue"] extends AnyDefaultValue ? null | undefined : never);
}>;

declare const __VAR_REF_BRAND__: unique symbol;
/** Nominal reference used to defer variable binding while carrying type info. */
export class VarRef<TMeta extends AnyVarRefMeta> {
  declare readonly [__VAR_REF_BRAND__]: Hidden<TMeta>;

  private constructor(public readonly name: string) {}

  static create<TRef extends InputTypeSpecifier>(name: string): VarRefBy<TRef> {
    return new VarRef<VarRefMetaBy<TRef>>(name);
  }
}
