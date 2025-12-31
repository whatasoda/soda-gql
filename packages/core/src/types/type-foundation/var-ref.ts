import type { ConstValue } from "./const-value";
import type { InputTypeKind } from "./type-specifier";
import type { TypeProfile } from "./type-profile";

/**
 * @deprecated Use VarRefMetaV2 instead. Will be removed in a future version.
 */
export interface AnyVarRefMeta {
  readonly profile: TypeProfile.WithMeta;
  readonly signature: unknown;
}

/**
 * New VarRef meta interface using typeName + kind instead of full profile.
 * This simplifies type comparison and improves error messages.
 */
export interface VarRefMetaV2 {
  readonly typeName: string;
  readonly kind: InputTypeKind;
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
  | { readonly [key: string]: NestedValueElement }
  | readonly NestedValueElement[];

type NestedValueElement =
  | string
  | number
  | boolean
  | null
  | undefined
  | AnyVarRef
  | { readonly [key: string]: NestedValueElement }
  | readonly NestedValueElement[];

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
export const hasVarRefInside = (value: NestedValueElement): boolean => {
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
export type PathSegment = string;

/**
 * Proxy type that records property accesses.
 */
export type SelectableProxy<T> = T;

/**
 * Type-safe path builder function.
 * Used with getNameAt and getValueAt helpers.
 */
export type Selector<T, U> = (proxy: T) => U;

type ProxyInner = {
  readonly varInner: VarRefInner | { type: "virtual"; varName: string; varSegments: readonly PathSegment[] };
  readonly segments: readonly PathSegment[];
};

const SelectableProxyInnerRegistry = new WeakMap<any, ProxyInner>();
const getSelectableProxyInner = (proxy: any): ProxyInner => {
  const inner = SelectableProxyInnerRegistry.get(proxy);
  if (!inner) {
    throw new Error(`Proxy inner not found`);
  }
  return inner;
};

const createSelectableProxy = <T>(current: ProxyInner): T => {
  const proxy: T = new Proxy(Object.create(null), {
    get(_, property) {
      if (typeof property === "symbol") {
        throw new Error(`Prohibited property access: ${String(property)}`);
      }
      const nextSegments = [...current.segments, property];

      if (current.varInner.type === "virtual") {
        return createSelectableProxy({
          varInner: current.varInner,
          segments: nextSegments,
        });
      }

      if (current.varInner.type === "variable") {
        return createSelectableProxy({
          varInner: { type: "virtual", varName: current.varInner.name, varSegments: nextSegments },
          segments: nextSegments,
        });
      }

      if (typeof current.varInner.value === "object" && current.varInner.value !== null) {
        const value = (current.varInner.value as { [key: string]: NestedValueElement })[property];
        return createSelectableProxy({
          varInner: isVarRef(value) ? getVarRefInner(value) : { type: "nested-value", value },
          segments: nextSegments,
        });
      }

      throw new Error(`Cannot access children of primitive value at path [${current.segments.join(".")}]`);
    },
  });

  SelectableProxyInnerRegistry.set(proxy, current);

  return proxy;
};

/**
 * Get the variable name from a VarRef at a specific path.
 *
 * @param varRef - The VarRef containing a nested-value
 * @param selector - Path builder function, e.g., p => p.user.age
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
  selector: (proxy: TypeProfile.Type<T["profile"]>) => U,
): string => {
  const proxy = createSelectableProxy<TypeProfile.Type<T["profile"]>>({ varInner: VarRef.getInner(varRef), segments: [] });
  const selected = selector(proxy);
  const inner = getSelectableProxyInner(selected);

  if (inner.varInner.type === "virtual") {
    throw new Error(`Value at path [${inner.segments.join(".")}] is inside a variable`);
  }

  if (inner.varInner.type !== "variable") {
    throw new Error(`Value at path [${inner.segments.join(".")}] is not a variable`);
  }

  return inner.varInner.name;
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
  selector: (proxy: SelectableProxy<TypeProfile.Type<T["profile"]>>) => U,
): U => {
  const proxy = createSelectableProxy<TypeProfile.Type<T["profile"]>>({ varInner: VarRef.getInner(varRef), segments: [] });
  const selected = selector(proxy);
  const inner = getSelectableProxyInner(selected);

  if (inner.varInner.type === "virtual") {
    throw new Error(`Value at path [${inner.segments.join(".")}] is inside a variable`);
  }

  if (inner.varInner.type !== "nested-value") {
    throw new Error(`Value at path [${inner.segments.join(".")}] is not a nested-value`);
  }

  if (hasVarRefInside(inner.varInner.value)) {
    throw new Error(`Value at path [${inner.segments.join(".")}] contains nested VarRef`);
  }

  return inner.varInner.value as U;
};

export const getVariablePath = <T extends AnyVarRefMeta, U>(
  varRef: VarRef<T>,
  selector: (proxy: SelectableProxy<TypeProfile.Type<T["profile"]>>) => U,
): readonly PathSegment[] => {
  const proxy = createSelectableProxy<TypeProfile.Type<T["profile"]>>({ varInner: VarRef.getInner(varRef), segments: [] });
  const selected = selector(proxy);
  const inner = getSelectableProxyInner(selected);

  if (inner.varInner.type === "virtual") {
    return [`$${inner.varInner.varName}`, ...inner.segments.slice(inner.varInner.varSegments.length)];
  }

  if (inner.varInner.type === "variable") {
    return [`$${inner.varInner.name}`];
  }

  throw new Error(`Value at path [${inner.segments.join(".")}] is not a variable or inside a variable`);
};
