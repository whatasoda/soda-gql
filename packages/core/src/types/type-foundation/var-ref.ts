import type { TypeModifier, TypeProfile } from "./common";
import type { ConstValue } from "./const-value";
import type { ApplyTypeModifier } from "./type-modifier.generated";
import type { InputTypeSpecifier } from "./type-specifier";

/** Nominal reference placeholder used inside `AnyVariableAssignments`. */
export type AnyVarRef = VarRef<any>;

interface AnyVarRefMeta {
  readonly kind: string;
  readonly name: string;
  readonly signature: unknown;
}

export type VarRefBy<TSpecifier extends InputTypeSpecifier> = VarRef<VarRefMeta<TSpecifier>>;
interface VarRefMeta<TSpecifier extends InputTypeSpecifier> {
  readonly kind: TSpecifier["kind"];
  readonly name: TSpecifier["name"];
  readonly signature: ApplyTypeModifier<"[MODIFIER_SIGNATURE]", TSpecifier["modifier"]>;
}

type VarRefInner =
  | {
      type: "variable";
      name: string;
    }
  | {
      type: "const-value";
      value: ConstValue;
    };

declare const __VAR_REF_BRAND__: unique symbol;
/** Nominal reference used to defer variable binding while carrying type info. */
export class VarRef<TMeta extends AnyVarRefMeta> {
  declare readonly [__VAR_REF_BRAND__]: TMeta;

  private constructor(private readonly inner: VarRefInner) {}

  static createForVariable<TSpecifier extends InputTypeSpecifier>(name: string): VarRef<VarRefMeta<TSpecifier>> {
    return new VarRef<VarRefMeta<TSpecifier>>({ type: "variable", name });
  }

  static createForConstValue<TSpecifier extends InputTypeSpecifier>(value: ConstValue): VarRef<VarRefMeta<TSpecifier>> {
    return new VarRef<VarRefMeta<TSpecifier>>({ type: "const-value", value });
  }

  static getInner(varRef: AnyVarRef): VarRefInner {
    return varRef.inner;
  }
}

export type AssignableVarRef<TType extends TypeProfile, TModifier extends TypeModifier, TWithDefault extends boolean> = VarRef<{
  readonly kind: TType["kind"];
  readonly name: TType["name"];
  readonly signature:
    | ApplyTypeModifier<"[MODIFIER_SIGNATURE]", TModifier>
    // NOTE: Allow undefined for arguments with default value
    | (TWithDefault extends true ? undefined : never);
}>;
