import type { AnySlicePayload, AnySlicePayloads } from "../../packages/core/src/types/element/slice";
import type { Projection } from "../../packages/core/src/types/runtime/projection";

export function createTestSlices<TSlices extends Record<string, Projection<any>> = Record<string, Projection<any>>>(
  projections: TSlices,
): AnySlicePayloads {
  const fragments: AnySlicePayloads = {};

  for (const [key, projection] of Object.entries(projections)) {
    fragments[key] = {
      projection,
      variables: {},
      getFields: () => ({}),
    } satisfies AnySlicePayload;
  }

  return fragments;
}
