import type { AnyModel } from "../types/operation";
import { pseudoTypeAnnotation, type StripFunctions, type StripSymbols } from "../types/shared/utility";

export type RuntimeModelInput = {
  prebuild: StripFunctions<AnyModel>;
  runtime: {
    normalize: (raw: unknown) => object;
  };
};

export const createRuntimeModel = (input: RuntimeModelInput): AnyModel =>
  ({
    typename: input.prebuild.typename,
    fragment: pseudoTypeAnnotation(),
    normalize: input.runtime.normalize,
  }) satisfies StripSymbols<AnyModel> as unknown as AnyModel;
