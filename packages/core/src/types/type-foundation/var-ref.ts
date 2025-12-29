import type { ConstValue } from "./const-value";
import type { TypeProfile } from "./type-profile";

export interface AnyVarRefMeta {
  readonly profile: TypeProfile;
  readonly signature: unknown;
}

/**
 * A nested value that can contain:
 * - Primitive ConstValue (string, number, boolean, null, undefined)
 * - VarRef at any nesting level
 * - Objects with NestedValue fields
 * - Arrays of NestedValue
 */
export type NestedValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | AnyVarRef
  | { readonly [key: string]: NestedValue }
  | readonly NestedValue[];

export type VarRefInner =
  | {
      type: "variable";
      name: string;
    }
  | {
      type: "nested-value";
      value: NestedValue;
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

/**
 * Recursively checks if a NestedValue contains any VarRef.
 * Used by getVarRefValue to determine if it's safe to return as ConstValue.
 */
export const hasVarRefInside = (value: NestedValue): boolean => {
  if (isVarRef(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some(hasVarRefInside);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).some(hasVarRefInside);
  }

  return false;
};

export const createVarRefFromVariable = <TProfile extends TypeProfile.WithMeta>(name: string) => {
  return new VarRef<TypeProfile.AssigningVarRefMeta<TProfile>>({ type: "variable", name });
};

export const createVarRefFromNestedValue = <TProfile extends TypeProfile.WithMeta>(value: NestedValue) => {
  return new VarRef<TypeProfile.AssigningVarRefMeta<TProfile>>({ type: "nested-value", value });
};

export const getVarRefInner = (varRef: AnyVarRef): VarRefInner => {
  return VarRef.getInner(varRef);
};

/**
 * Get the variable name from a VarRef.
 * Throws if the VarRef contains a nested-value instead of a variable reference.
 */
export const getVarRefName = (varRef: AnyVarRef): string => {
  const inner = VarRef.getInner(varRef);
  if (inner.type !== "variable") {
    throw new Error("Expected variable reference, got nested-value");
  }
  return inner.name;
};

/**
 * Get the const value from a VarRef.
 * Throws if the VarRef contains a variable reference instead of a nested-value,
 * or if the nested-value contains any VarRef inside.
 */
export const getVarRefValue = (varRef: AnyVarRef): ConstValue => {
  const inner = VarRef.getInner(varRef);
  if (inner.type !== "nested-value") {
    throw new Error("Expected nested-value, got variable reference");
  }
  if (hasVarRefInside(inner.value)) {
    throw new Error("Cannot get const value: nested-value contains VarRef");
  }
  return inner.value as ConstValue;
};
