import type { GraphQLFormattedError } from "graphql";
import type { AnyProjection, Projection } from "./projection";
import { createPathGraph, type ProjectionPathGraphNode } from "./projection-path-graph";
import { SlicedExecutionResultEmpty, SlicedExecutionResultError, SlicedExecutionResultSuccess } from "./sliced-execution-result";
import type { NormalizedExecutionResult } from "./types";

const DIRECT_LABEL = "__direct__";

/**
 * Creates a projection path graph from a single projection without label prefixing.
 * Unlike createPathGraphFromSliceEntries, this does not prefix segments with labels.
 */
function createPathGraphFromProjection(projection: AnyProjection): ProjectionPathGraphNode {
  const paths = projection.paths.map(({ full: raw, segments }) => ({
    label: DIRECT_LABEL,
    raw,
    segments: [...segments],
  }));
  return createPathGraph(paths);
}

function* generateErrorMapEntries(errors: readonly GraphQLFormattedError[], projectionPathGraph: ProjectionPathGraphNode) {
  for (const error of errors) {
    const errorPath = error.path ?? [];
    let stack = projectionPathGraph;

    for (let i = 0; i <= errorPath.length; i++) {
      const segment = errorPath[i];

      if (segment == null || typeof segment === "number") {
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
 * Creates a direct execution result parser for single fragment operations.
 * Unlike createExecutionResultParser, this does not apply label prefixing
 * and returns the projected value directly.
 *
 * Use this for operations that use a single fragment spread without $colocate:
 *
 * @example
 * ```typescript
 * const parser = createDirectParser(productFragment);
 *
 * const result = parser({
 *   type: "graphql",
 *   body: { data: { createProduct: { id: "123" } }, errors: undefined },
 * });
 * // result is the projected type directly
 * ```
 */
export const createDirectParser = <TProjected>(fragmentWithProjection: { readonly projection: Projection<TProjected> }) => {
  const { projection } = fragmentWithProjection;
  const projectionPathGraph = createPathGraphFromProjection(projection);

  return (result: NormalizedExecutionResult<object, object>): TProjected => {
    if (result.type === "non-graphql-error") {
      return projection.projector(new SlicedExecutionResultError({ type: "non-graphql-error", error: result.error }));
    }

    if (result.type === "empty") {
      return projection.projector(new SlicedExecutionResultEmpty());
    }

    if (result.type === "graphql") {
      const errorMaps = createErrorMaps(result.body.errors, projectionPathGraph);
      const matchedErrors = projection.paths.flatMap(({ full: raw }) => errorMaps[DIRECT_LABEL]?.[raw] ?? []);
      const uniqueErrors = Array.from(new Set(matchedErrors.map(({ error }) => error)).values());

      if (uniqueErrors.length > 0) {
        return projection.projector(new SlicedExecutionResultError({ type: "graphql-error", errors: uniqueErrors }));
      }

      const dataResults = projection.paths.map(({ segments }) =>
        result.body.data ? accessDataByPathSegments(result.body.data, segments) : { error: new Error("No data") },
      );

      if (dataResults.some(({ error }) => error)) {
        const errors = dataResults.flatMap(({ error }) => (error ? [error] : []));
        return projection.projector(new SlicedExecutionResultError({ type: "parse-error", errors }));
      }

      const dataList = dataResults.map(({ data }) => data);
      return projection.projector(new SlicedExecutionResultSuccess(dataList));
    }

    throw new Error("Invalid result type", { cause: result satisfies never });
  };
};
