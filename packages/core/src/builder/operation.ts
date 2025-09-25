import type { DocumentNode } from "graphql";
import {
  type AnyExecutionResultProjectionSingle,
  type AnyGraphqlSchema,
  type AnyOperationSlice,
  type EmptyObject,
  ExecutionResultProjection,
  type ExecutionResultProjectionPathGraph,
  type GraphqlAdapter,
  hidden,
  type InputTypeRefs,
  type Operation,
  type OperationBuilder,
  type OperationFn,
  type OperationType,
} from "../types";
import { buildDocument } from "./document-builder";
import { createVariableReferences } from "./input";

export const createOperationFactory =
  <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>(_schema: TSchema, _adapter: TAdapter) =>
  <TOperationType extends OperationType>(operationType: TOperationType): OperationFn<TSchema, TAdapter, TOperationType> => {
    const operationFn: OperationFn<TSchema, TAdapter, TOperationType> = <
      TName extends string,
      TSlices extends { [key: string]: AnyOperationSlice<TSchema, TAdapter, TOperationType> },
      TVariableDefinitions extends InputTypeRefs = EmptyObject,
    >(
      name: TName,
      variablesDefinitions: TVariableDefinitions | null,
      builder: OperationBuilder<TSchema, TAdapter, TOperationType, TVariableDefinitions, TSlices>,
    ) => {
      const variables = (variablesDefinitions ?? {}) as TVariableDefinitions;
      const $ = createVariableReferences<TSchema, TVariableDefinitions>(variables);

      const slices = builder({ $ });
      const fields = Object.entries(slices).flatMap(([label, slice]) =>
        Object.entries(slice.fields).map(([key, reference]) => ({ labeledKey: `${label}_${key}`, key, reference })),
      );

      const document: DocumentNode = buildDocument({
        name,
        operationType: operationType,
        variables,
        fields: Object.fromEntries(fields.map(({ labeledKey, reference }) => [labeledKey, reference])),
      });

      const sliceEntries = Object.entries(slices).map(([label, slice]) => ({
        label,
        slice,
        rawProjection: slice.getProjections(),
      }));

      const projections = sliceEntries.flatMap(({ label, rawProjection: raw }) =>
        raw instanceof ExecutionResultProjection
          ? [{ label, projection: raw }]
          : Object.values(raw).map((projection) => ({
              label,
              projection,
            })),
      );

      const projectionPathGraph = createPathGraphFromLabeledProjections(projections);

      const operation: Operation<TSchema, TAdapter, TOperationType, TName, TVariableDefinitions, TSlices> = {
        _input: hidden(),
        _raw: hidden(),
        _output: hidden(),
        type: operationType,
        name,
        document: document as Operation<TSchema, TAdapter, TOperationType, TName, TVariableDefinitions, TSlices>["document"],
        projectionPathGraph,
        parse: hidden(), // TODO: implement
      };

      return operation;
    };

    return operationFn;
  };

type ExecutionResultProjectionPathGraphIntermediate = {
  [segment: string]: { label: string; path: string; segments: string[] }[];
};

const createPathGraph = (paths: ExecutionResultProjectionPathGraphIntermediate[string]): ExecutionResultProjectionPathGraph => {
  const intermediate = paths.reduce(
    (acc: ExecutionResultProjectionPathGraphIntermediate, { label, path, segments: [first, ...rest] }) => {
      if (first) {
        (acc[first] || (acc[first] = [])).push({ label, path, segments: rest });
      }
      return acc;
    },
    {},
  );

  return Object.fromEntries(
    Object.entries(intermediate).map(([segment, paths]) => [
      segment,
      {
        matches: paths.map(({ label, path }) => ({ label, path })),
        children: createPathGraph(paths),
      } satisfies ExecutionResultProjectionPathGraph[string],
    ]),
  );
};

const createPathGraphFromLabeledProjections = <TAdapter extends GraphqlAdapter>(
  projections: { label: string; projection: AnyExecutionResultProjectionSingle<TAdapter> }[],
) => {
  const paths = projections.map(({ label, projection }) => ({
    label,
    path: projection.path,
    segments: projection.path.replace("$.", `${label}_`).split("."),
  }));

  return createPathGraph(paths);
};
