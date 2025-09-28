import type { DocumentNode, GraphQLFormattedError } from "graphql";
import { createVariableReferences } from "../builder/input";
import {
  type AnyAssignableInput,
  type AnyGraphqlSchema,
  type AnyOperationSlices,
  type ExecutionResultProjectionPathGraphNode,
  type GraphqlRuntimeAdapter,
  type InputTypeRef,
  type InputTypeRefs,
  type Operation,
  type OperationType,
  pseudoTypeAnnotation,
  SliceResultEmpty,
  SliceResultError,
  SliceResultSuccess,
} from "../types";
import type { NormalizedExecutionResult } from "../types/execution-result";

type GeneratedOperation = {
  name: string;
  document: DocumentNode;
  projectionPathGraph: ExecutionResultProjectionPathGraphNode;
  variableNames: string[];
  getSlices: (tools: { $: AnyAssignableInput }) => AnyOperationSlices<AnyGraphqlSchema, GraphqlRuntimeAdapter, OperationType>;
};

export const runtimeOperation = (operationType: OperationType) => (generated: GeneratedOperation) =>
  ({
    _input: pseudoTypeAnnotation(),
    _raw: pseudoTypeAnnotation(),
    _output: pseudoTypeAnnotation(),
    type: operationType,
    name: generated.name,
    document: generated.document as Operation<
      AnyGraphqlSchema,
      GraphqlRuntimeAdapter,
      OperationType,
      string,
      InputTypeRefs,
      AnyOperationSlices<AnyGraphqlSchema, GraphqlRuntimeAdapter, OperationType>
    >["document"],
    projectionPathGraph: generated.projectionPathGraph,
    variableNames: generated.variableNames,
    parse: createParse({
      slices: generated.getSlices({
        $: createVariableReferences<AnyGraphqlSchema, InputTypeRefs>(
          Object.fromEntries(generated.variableNames.map((name) => [name, null as unknown as InputTypeRef])),
        ),
      }),
      projectionPathGraph: generated.projectionPathGraph,
    }),
  }) satisfies Operation<
    AnyGraphqlSchema,
    GraphqlRuntimeAdapter,
    OperationType,
    string,
    InputTypeRefs,
    AnyOperationSlices<AnyGraphqlSchema, GraphqlRuntimeAdapter, OperationType>
  >;

function* generateErrorMapEntries(
  errors: readonly GraphQLFormattedError[],
  projectionPathGraph: ExecutionResultProjectionPathGraphNode,
) {
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

const createErrorMaps = (
  errors: readonly GraphQLFormattedError[] | undefined,
  projectionPathGraph: ExecutionResultProjectionPathGraphNode,
) => {
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

export const createParse = <
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
>({
  slices,
  projectionPathGraph,
}: {
  slices: AnyOperationSlices<TSchema, TRuntimeAdapter, TOperationType>;
  projectionPathGraph: ExecutionResultProjectionPathGraphNode;
}) => {
  const prepare = (result: NormalizedExecutionResult<TRuntimeAdapter, object, object>) => {
    if (result.type === "graphql") {
      const errorMaps = createErrorMaps(result.body.errors, projectionPathGraph);

      return { ...result, errorMaps };
    }

    if (result.type === "non-graphql-error") {
      return { ...result, error: new SliceResultError({ type: "non-graphql-error", error: result.error }) };
    }

    if (result.type === "empty") {
      return { ...result, error: new SliceResultEmpty() };
    }

    throw new Error("Invalid result type", { cause: result satisfies never });
  };

  return (result: NormalizedExecutionResult<TRuntimeAdapter, object, object>) => {
    const prepared = prepare(result);

    const entries = Object.entries(slices).map(([label, slice]) => {
      const { projection } = slice;
        
      if (prepared.type === "graphql") {
        const matchedErrors = projection.paths.flatMap(({ raw }) => prepared.errorMaps[label]?.[raw] ?? []);
        const uniqueErrors = Array.from(new Set(matchedErrors.map(({ error }) => error)).values());

        if (uniqueErrors.length > 0) {
          return [label, projection.projector(new SliceResultError({ type: "graphql-error", errors: uniqueErrors }))];
        }

        const dataResults = projection.paths.map(({ segments }) => prepared.body.data
          ? accessDataByPathSegments(prepared.body.data, segments)
          : { error: new Error("No data") });
        if (dataResults.some(({ error }) => error)) {
          const errors = dataResults.flatMap(({ error }) => error ? [error] : []);
          const combinedError = new Error(`Parse errors: ${errors.map(e => e.message).join(', ')}`);
          return [label, projection.projector(new SliceResultError({ type: "parse-error", errors: combinedError }))];
        }

        const dataList = dataResults.map(({ data }) => data);
        return [label, projection.projector(new SliceResultSuccess(dataList))];
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
