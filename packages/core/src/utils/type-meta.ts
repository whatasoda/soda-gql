export interface WithTypeMeta<T extends object> {
  readonly $type: T;
}

export const withTypeMeta = <TTarget extends WithTypeMeta<TTypeMeta>, TTypeMeta extends object>(
  target: Omit<NoInfer<TTarget>, "$type">,
): TTarget => {
  if (process.env.NODE_ENV !== "production") {
    if ((typeof target !== "object" && typeof target !== "function") || target === null) {
      throw new Error("Target must be an object or a function.");
    }

    Object.defineProperty(target, "$type", {
      get() {
        throw new Error("This property is only for type inference. Do not access this property directly.");
      },
    });
  }

  return target as TTarget;
};
