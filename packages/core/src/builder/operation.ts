import type { DocumentNode } from "graphql";
import {
  type AnyFields,
  type AnyGraphqlSchema,
  type AnyOperationSlice,
  type AnyOperationSlices,
  type EmptyObject,
  type ExecutionResultProjectionPathGraphNode,
  type GraphqlRuntimeAdapter,
  type InputTypeRefs,
  type Operation,
  type OperationBuilder,
  type OperationFn,
  type OperationType,
  pseudoTypeAnnotation,
} from "../types";
import { buildDocument } from "./document-builder";
import { createVariableReferences } from "./input";

export const createOperationFactory =
  <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends GraphqlRuntimeAdapter>(
    _schema: TSchema,
    _adapter: TRuntimeAdapter,
  ) =>
  <TOperationType extends OperationType>(
    operationType: TOperationType,
  ): OperationFn<TSchema, TRuntimeAdapter, TOperationType> => {
    const operationFn: OperationFn<TSchema, TRuntimeAdapter, TOperationType> = <
      TName extends string,
      TSlices extends { [key: string]: AnyOperationSlice<TSchema, TRuntimeAdapter, TOperationType> },
      TVariableDefinitions extends InputTypeRefs = EmptyObject,
    >(
      name: TName,
      variablesDefinitions: TVariableDefinitions | null,
      builder: OperationBuilder<TSchema, TRuntimeAdapter, TOperationType, TVariableDefinitions, TSlices>,
    ) => {
      const variables = (variablesDefinitions ?? {}) as TVariableDefinitions;
      const $ = createVariableReferences<TSchema, TVariableDefinitions>(variables);
      const slices = builder({ $ });

      const fields: AnyFields = Object.fromEntries(
        Object.entries(slices).flatMap(([label, slice]) =>
          Object.entries(slice.getFields()).map(([key, reference]) => [`${label}_${key}`, reference]),
        ),
      );

      const document: DocumentNode = buildDocument({
        name,
        operationType,
        variables,
        fields,
      });

      const projectionPathGraph = createPathGraphFromSliceEntries(slices);

      const operation: Operation<TSchema, TRuntimeAdapter, TOperationType, TName, TVariableDefinitions, TSlices> = {
        _input: pseudoTypeAnnotation(),
        _raw: pseudoTypeAnnotation(),
        _output: pseudoTypeAnnotation(),
        type: operationType,
        name,
        variableNames: Object.keys(variables),
        document: document as Operation<
          TSchema,
          TRuntimeAdapter,
          TOperationType,
          TName,
          TVariableDefinitions,
          TSlices
        >["document"],
        projectionPathGraph,
        parse: pseudoTypeAnnotation(), // TODO: implement
      };

      return operation;
    };

    return operationFn;
  };

type ExecutionResultProjectionPathGraphIntermediate = {
  [segment: string]: { label: string; raw: string; segments: string[] }[];
};

function createPathGraph(paths: ExecutionResultProjectionPathGraphIntermediate[string]): ExecutionResultProjectionPathGraphNode {
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
  } satisfies ExecutionResultProjectionPathGraphNode;
}

function createPathGraphFromSliceEntries<
  TSchema extends AnyGraphqlSchema,
  TRuntimeAdapter extends GraphqlRuntimeAdapter,
  TOperationType extends OperationType,
>(slices: AnyOperationSlices<TSchema, TRuntimeAdapter, TOperationType>) {
  const paths = Object.entries(slices).flatMap(([label, slice]) => Array.from(new Map(slice.projection.paths.map(({ raw, segments }) => {
    const [first, ...rest] = segments;
    return [raw, { label, raw, segments: [`${label}_${first}`, ...rest] }];
  })).values()));

  return createPathGraph(paths);
}
