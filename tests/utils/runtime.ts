import type { AnySliceContent, AnySliceContents } from "../../packages/core/src/types/operation/slice";
import type { Projection } from "../../packages/core/src/types/runtime/projection";

export function createTestSlices<TSlices extends Record<string, Projection<any>> = Record<string, Projection<any>>>(
  projections: TSlices,
): AnySliceContents {
  const fragments: AnySliceContents = {};

  for (const [key, projection] of Object.entries(projections)) {
    fragments[key] = {
      projection,
      variables: {},
      getFields: () => ({}),
    } satisfies AnySliceContent;
  }

  return fragments;
}
