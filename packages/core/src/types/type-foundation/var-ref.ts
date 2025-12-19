import type { ConstValue } from "./const-value";
import type { TypeProfile } from "./type-profile";

export interface AnyVarRefMeta {
  readonly profile: TypeProfile;
  readonly signature: unknown;
}

export type VarRefInner =
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

/**
 * Get the variable name from a VarRef.
 * Throws if the VarRef contains a const-value instead of a variable reference.
 */
export const getVarRefName = (varRef: AnyVarRef): string => {
  const inner = VarRef.getInner(varRef);
  if (inner.type !== "variable") {
    throw new Error("Expected variable reference, got const-value");
  }
  return inner.name;
};

/**
 * Get the const value from a VarRef.
 * Throws if the VarRef contains a variable reference instead of a const-value.
 */
export const getVarRefValue = (varRef: AnyVarRef): ConstValue => {
  const inner = VarRef.getInner(varRef);
  if (inner.type !== "const-value") {
    throw new Error("Expected const-value, got variable reference");
  }
  return inner.value;
};
