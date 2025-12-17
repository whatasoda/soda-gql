export type Inferrable<TTarget, TInfer extends object> = TTarget & { readonly $infer: TInfer };

// Meta types for each GqlElement type
export type ModelInferMeta<TVariables, TRaw extends object, TNormalized extends object> = {
  readonly input: TVariables;
  readonly output: { readonly raw: TRaw; readonly normalized: TNormalized };
};

export type SliceInferMeta<TVariables, TProjected> = {
  readonly input: TVariables;
  readonly output: TProjected;
};

export type ComposedOperationInferMeta<TVariables, TRawData extends object, TProjectedData extends object> = {
  readonly input: TVariables;
  readonly output: { readonly raw: TRawData; readonly projected: TProjectedData };
};

export type InlineOperationInferMeta<TVariables, TData extends object> = {
  readonly input: TVariables;
  readonly output: TData;
};

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
