import type { ConstValue } from "./const-value";
import type { TypeProfile } from "./type-profile";

export interface AnyVarRefMeta {
  readonly profile: TypeProfile;
  readonly signature: unknown;
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

export type AnyVarRef = VarRef<any>;

declare const __VAR_REF_BRAND__: unique symbol;
export class VarRef<TMeta extends AnyVarRefMeta> {
  declare readonly [__VAR_REF_BRAND__]: TMeta;

  constructor(private readonly inner: VarRefInner) {}

  static getInner(varRef: AnyVarRef): VarRefInner {
    return varRef.inner;
  }
}

export const isVarRef = (value: unknown): value is AnyVarRef => {
  return typeof value === "object" && value !== null && value instanceof VarRef;
};

export const createVarRefFromVariable = <TProfile extends TypeProfile.WithMeta>(name: string) => {
  return new VarRef<TypeProfile.AssigningVarRefMeta<TProfile>>({ type: "variable", name });
};

export const createVarRefFromConstValue = <TProfile extends TypeProfile.WithMeta>(value: ConstValue) => {
  return new VarRef<TypeProfile.AssigningVarRefMeta<TProfile>>({ type: "const-value", value });
};

export const getVarRefInner = (varRef: AnyVarRef): VarRefInner => {
  return VarRef.getInner(varRef);
};
