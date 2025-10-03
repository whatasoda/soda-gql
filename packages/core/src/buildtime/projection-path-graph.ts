import type { AnySliceContent, ProjectionPathGraphNode } from "../types/operation";

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
    children: Object.fromEntries(Object.entries(intermediate).map(([segment, paths]) => [segment, createPathGraph(paths)])),
  } satisfies ProjectionPathGraphNode;
}

export function createPathGraphFromSliceEntries(fragments: { [key: string]: AnySliceContent }) {
  const paths = Object.entries(fragments).flatMap(([label, slice]) =>
    Array.from(
      new Map(
        slice.projection.paths.map(({ raw, segments }) => {
          const [first, ...rest] = segments;
          return [raw, { label, raw, segments: [`${label}_${first}`, ...rest] }];
        }),
      ).values(),
    ),
  );

  return createPathGraph(paths);
}
