import type { GraphQLFormattedError } from "graphql";
import type { InferExecutionResultProjection } from "./projection";
import { type AnySlicePayloads, createPathGraphFromSliceEntries, type ProjectionPathGraphNode } from "./projection-path-graph";
import { SlicedExecutionResultEmpty, SlicedExecutionResultError, SlicedExecutionResultSuccess } from "./sliced-execution-result";
import type { NormalizedExecutionResult } from "./types";

/** Inferred result type for parsed slices */
type ParsedSlices<TSlices extends AnySlicePayloads> = {
  [K in keyof TSlices]: InferExecutionResultProjection<TSlices[K]["projection"]>;
};

// Internal function to build path graph from slices
const createPathGraphFromSlices = createPathGraphFromSliceEntries;

function* generateErrorMapEntries(errors: readonly GraphQLFormattedError[], projectionPathGraph: ProjectionPathGraphNode) {
  for (const error of errors) {
    const errorPath = error.path ?? [];
    let stack = projectionPathGraph;

    for (
      let i = 0;
      // i <= errorPath.length to handle the case where the error path is empty
      i <= errorPath.length;
      i++
    ) {
      const segment = errorPath[i];

      if (
        // the end of the path
        segment == null ||
        // FieldPath does not support index access. We treat it as the end of the path.
        typeof segment === "number"
      ) {
        yield* stack.matches.map(({ label, path }) => ({ label, path, error }));
        break;
      }

      yield* stack.matches.filter(({ exact }) => exact).map(({ label, path }) => ({ label, path, error }));

      const next = stack.children[segment];
      if (!next) {
        break;
      }

      stack = next;
    }
  }
}

const createErrorMaps = (errors: readonly GraphQLFormattedError[] | undefined, projectionPathGraph: ProjectionPathGraphNode) => {
  const errorMaps: { [label: string]: { [path: string]: { error: GraphQLFormattedError }[] } } = {};
  for (const { label, path, error } of generateErrorMapEntries(errors ?? [], projectionPathGraph)) {
    const mapPerLabel = errorMaps[label] || (errorMaps[label] = {});
    const mapPerPath = mapPerLabel[path] || (mapPerLabel[path] = []);
    mapPerPath.push({ error });
  }
  return errorMaps;
};

const accessDataByPathSegments = (data: object, pathSegments: string[]) => {
  let current: unknown = data;

  for (const segment of pathSegments) {
    if (current == null) {
      return { error: new Error("No data") };
    }

    if (typeof current !== "object") {
      return { error: new Error("Incorrect data type") };
    }

    if (Array.isArray(current)) {
      return { error: new Error("Incorrect data type") };
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return { data: current };
};

/**
 * Creates an execution result parser for composed operations.
 * The parser maps GraphQL errors and data to their corresponding slices
 * based on the projection path graph.
 *
 * @param slices - Object mapping labels to projections
 * @returns A parser function that takes a NormalizedExecutionResult and returns parsed slices
 *
 * @example
 * ```typescript
 * const parser = createExecutionResultParser({
 *   userCard: userCardProjection,
 *   posts: postsProjection,
 * });
 *
 * const results = parser({
 *   type: "graphql",
 *   body: { data, errors },
 * });
 * ```
 */
export const createExecutionResultParser = <TSlices extends AnySlicePayloads>(
  slices: TSlices,
): ((result: NormalizedExecutionResult<object, object>) => ParsedSlices<TSlices>) => {
  // Build path graph from slices
  const projectionPathGraph = createPathGraphFromSlices(slices);
  const fragments = slices;
  const prepare = (result: NormalizedExecutionResult<object, object>) => {
    if (result.type === "graphql") {
      const errorMaps = createErrorMaps(result.body.errors, projectionPathGraph);

      return { ...result, errorMaps };
    }

    if (result.type === "non-graphql-error") {
      return { ...result, error: new SlicedExecutionResultError({ type: "non-graphql-error", error: result.error }) };
    }

    if (result.type === "empty") {
      return { ...result, error: new SlicedExecutionResultEmpty() };
    }

    throw new Error("Invalid result type", { cause: result satisfies never });
  };

  return (result: NormalizedExecutionResult<object, object>) => {
    const prepared = prepare(result);

    const entries = Object.entries(fragments).map(([label, fragment]) => {
      const { projection } = fragment;

      if (prepared.type === "graphql") {
        const matchedErrors = projection.paths.flatMap(({ full: raw }) => prepared.errorMaps[label]?.[raw] ?? []);
        const uniqueErrors = Array.from(new Set(matchedErrors.map(({ error }) => error)).values());

        if (uniqueErrors.length > 0) {
          return [label, projection.projector(new SlicedExecutionResultError({ type: "graphql-error", errors: uniqueErrors }))];
        }

        // Apply label prefix to first segment for data access (matching $colocate prefix pattern)
        const dataResults = projection.paths.map(({ segments }) => {
          const [first, ...rest] = segments;
          const prefixedSegments = [`${label}_${first}`, ...rest];
          return prepared.body.data
            ? accessDataByPathSegments(prepared.body.data, prefixedSegments)
            : { error: new Error("No data") };
        });
        if (dataResults.some(({ error }) => error)) {
          const errors = dataResults.flatMap(({ error }) => (error ? [error] : []));
          return [label, projection.projector(new SlicedExecutionResultError({ type: "parse-error", errors }))];
        }

        const dataList = dataResults.map(({ data }) => data);
        return [label, projection.projector(new SlicedExecutionResultSuccess(dataList))];
      }

      if (prepared.type === "non-graphql-error") {
        return [label, projection.projector(prepared.error)];
      }

      if (prepared.type === "empty") {
        return [label, projection.projector(prepared.error)];
      }

      throw new Error("Invalid result type", { cause: prepared satisfies never });
    });

    return Object.fromEntries(entries);
  };
};
