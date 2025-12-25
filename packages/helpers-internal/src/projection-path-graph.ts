import type { AnyProjection } from "./projection";
import { mapValues } from "./utils/map-values";

/**
 * Node in the projection path graph tree.
 * Used for mapping GraphQL errors and data to their corresponding slices.
 */
export type ProjectionPathGraphNode = {
  readonly matches: { label: string; path: string; exact: boolean }[];
  readonly children: { readonly [segment: string]: ProjectionPathGraphNode };
};

/**
 * Payload from a slice that contains projection and lazy field retrieval.
 */
export type AnySlicePayload = {
  readonly projection: AnyProjection;
  readonly getFields: () => unknown;
};

export type AnySlicePayloads = Record<string, AnySlicePayload>;

type ExecutionResultProjectionPathGraphIntermediate = {
  [segment: string]: { label: string; raw: string; segments: string[] }[];
};

function createPathGraph(paths: ExecutionResultProjectionPathGraphIntermediate[string]): ProjectionPathGraphNode {
  const intermediate = paths.reduce(
    (acc: ExecutionResultProjectionPathGraphIntermediate, { label, raw, segments: [segment, ...segments] }) => {
      if (segment) {
        (acc[segment] || (acc[segment] = [])).push({ label, raw, segments });
      }
      return acc;
    },
    {},
  );

  return {
    matches: paths.map(({ label, raw, segments }) => ({ label, path: raw, exact: segments.length === 0 })),
    children: mapValues(intermediate, (paths) => createPathGraph(paths)),
  } satisfies ProjectionPathGraphNode;
}

/**
 * Creates a projection path graph from slice entries with field prefixing.
 * Each slice's paths are prefixed with the slice label for disambiguation.
 */
export function createPathGraphFromSliceEntries(fragments: AnySlicePayloads) {
  const paths = Object.entries(fragments).flatMap(([label, slice]) =>
    Array.from(
      new Map(
        slice.projection.paths.map(({ full: raw, segments }) => {
          const [first, ...rest] = segments;
          return [raw, { label, raw, segments: [`${label}_${first}`, ...rest] }];
        }),
      ).values(),
    ),
  );

  return createPathGraph(paths);
}
