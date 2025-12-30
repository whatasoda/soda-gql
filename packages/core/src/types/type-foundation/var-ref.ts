import type { ConstValue } from "./const-value";
import type { TypeProfile } from "./type-profile";

export interface AnyVarRefMeta {
  readonly profile: TypeProfile.WithMeta;
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

// ============================================================================
// Path Types and Utilities
// ============================================================================

/**
 * Path segment types for navigating nested values.
 */
export type PathSegment = string | number;

/**
 * Proxy type that records property accesses.
 * The actual implementation uses Proxy to capture the path.
 *
 * TODO: Full type-safe path inference is complex and deferred.
 * Current implementation uses 'any' for simplicity.
 * The runtime behavior is correct; only compile-time type checking is limited.
 */
export type PathProxy<T> = { [K in keyof T]: PathProxy<T[K]> };

/**
 * Type-safe path builder function.
 * Used with getNameAt and getValueAt helpers.
 *
 * @example
 * getNameAt(varRef, p => p.user.addresses[0].street)
 *
 * Note: Full Proxy-based type inference is marked as TODO.
 * Current implementation supports runtime path extraction without
 * compile-time type checking of the path validity.
 */
export type PathBuilder<T, U> = (proxy: T) => U;

/**
 * Internal symbol to store path segments on PathProxy.
 */
export const PATH_SEGMENTS = Symbol("PATH_SEGMENTS");

interface PathProxyInternal {
  readonly [PATH_SEGMENTS]: readonly PathSegment[];
}

/**
 * Creates a proxy that records property accesses as a path.
 * Used internally by getNameAt and getValueAt.
 */
export const createPathProxy = <T>(segments: readonly PathSegment[] = []): PathProxy<T> => {
  return new Proxy({ [PATH_SEGMENTS]: segments } as PathProxyInternal & PathProxy<T>, {
    get(target, prop) {
      if (prop === PATH_SEGMENTS) {
        return target[PATH_SEGMENTS];
      }

      // Handle both string keys and numeric indices
      const segment: PathSegment = typeof prop === "symbol" ? String(prop) : !Number.isNaN(Number(prop)) ? Number(prop) : prop;

      return createPathProxy([...target[PATH_SEGMENTS], segment]);
    },
  });
};

/**
 * Extracts the path segments from a PathBuilder function.
 */
export const extractPath = <T, U>(pathFn: PathBuilder<T, U>): readonly PathSegment[] => {
  const proxy = createPathProxy<T>();
  const result = pathFn(proxy as unknown as T) as unknown as PathProxyInternal;
  return result[PATH_SEGMENTS];
};

/**
 * Gets a value at the specified path within a NestedValue.
 * Returns undefined if path doesn't exist or encounters a VarRef before reaching the end.
 */
export const getNestedValue = (value: NestedValue, path: readonly PathSegment[]): NestedValue | undefined => {
  let current: NestedValue = value;

  for (const segment of path) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (isVarRef(current)) {
      // Cannot traverse into a VarRef
      return undefined;
    }

    if (typeof segment === "number" && Array.isArray(current)) {
      current = current[segment];
    } else if (typeof segment === "string" && typeof current === "object") {
      current = (current as { [key: string]: NestedValue })[segment];
    } else {
      return undefined;
    }
  }

  return current;
};

/**
 * Get the variable name from a VarRef at a specific path.
 *
 * @param varRef - The VarRef containing a nested-value
 * @param pathFn - Path builder function, e.g., p => p.user.age
 * @returns The variable name at the specified path
 * @throws If path doesn't lead to a VarRef with type "variable"
 *
 * @example
 * const ref = createVarRefFromNestedValue({
 *   user: { age: someVariableRef }
 * });
 * getNameAt(ref, p => p.user.age); // returns the variable name
 */
export const getNameAt = <T extends AnyVarRefMeta, U>(
  varRef: VarRef<T>,
  pathFn: PathBuilder<TypeProfile.Type<T["profile"]>, U>,
): string => {
  const inner = VarRef.getInner(varRef);
  if (inner.type !== "nested-value") {
    throw new Error("getNameAt requires a nested-value VarRef");
  }

  const path = extractPath(pathFn);
  const valueAtPath = getNestedValue(inner.value, path);

  if (!isVarRef(valueAtPath)) {
    throw new Error(`Expected VarRef at path [${path.join(".")}], got ${typeof valueAtPath}`);
  }

  return getVarRefName(valueAtPath);
};

/**
 * Get the const value from a nested-value VarRef at a specific path.
 *
 * @param varRef - The VarRef containing a nested-value
 * @param pathFn - Path builder function, e.g., p => p.user.name
 * @returns The const value at the specified path
 * @throws If path leads to a VarRef or if value contains VarRef inside
 *
 * @example
 * const ref = createVarRefFromNestedValue({
 *   user: { name: "Alice", age: someVariableRef }
 * });
 * getValueAt(ref, p => p.user.name); // returns "Alice"
 */
export const getValueAt = <T extends AnyVarRefMeta, U>(
  varRef: VarRef<T>,
  pathFn: PathBuilder<TypeProfile.Type<T["profile"]>, U>,
): U => {
  const inner = VarRef.getInner(varRef);
  if (inner.type !== "nested-value") {
    throw new Error("getValueAt requires a nested-value VarRef");
  }

  const path = extractPath(pathFn);
  const valueAtPath = getNestedValue(inner.value, path);

  if (valueAtPath === undefined) {
    return undefined as U;
  }

  if (isVarRef(valueAtPath)) {
    throw new Error(`Expected const value at path [${path.join(".")}], got VarRef`);
  }

  if (hasVarRefInside(valueAtPath)) {
    throw new Error(`Value at path [${path.join(".")}] contains nested VarRef`);
  }

  return valueAtPath as U;
};
