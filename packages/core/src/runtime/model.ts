import type { AnyModel } from "../types/element";
import { hidden } from "../utils/hidden";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";

export type RuntimeModelInput = {
  prebuild: StripFunctions<AnyModel>;
};

export const createRuntimeModel = (input: RuntimeModelInput): AnyModel =>
  ({
    typename: input.prebuild.typename,
    embed: hidden(),
  }) satisfies StripSymbols<AnyModel> as unknown as AnyModel;
