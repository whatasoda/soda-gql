import type { AnyFragment } from "../types/element";
import { hidden } from "../utils/hidden";
import type { StripFunctions, StripSymbols } from "../utils/type-utils";

export type RuntimeFragmentInput = {
  prebuild: StripFunctions<AnyFragment>;
};

export const createRuntimeFragment = (input: RuntimeFragmentInput): AnyFragment =>
  ({
    typename: input.prebuild.typename,
    embed: hidden(),
  }) satisfies StripSymbols<AnyFragment> as unknown as AnyFragment;
