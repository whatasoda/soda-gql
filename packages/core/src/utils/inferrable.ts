export type Inferrable<TTarget, TInfer extends object> = TTarget & { readonly $infer: TInfer };

export function inferrable<TTarget, TInfer extends object>(target: TTarget): Inferrable<TTarget, TInfer> {
  // if (process.env.NODE_ENV !== "production") {
  if ((typeof target !== "object" || target === null) && typeof target !== "function") {
    throw new Error("Target must be an object or a function.");
  }

  Object.defineProperty(target, "$infer", {
    get() {
      throw new Error("This property is only for type meta. Do not access this property directly.");
    },
  });
  // }

  return target as Inferrable<TTarget, TInfer>;
}
