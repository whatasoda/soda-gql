import { createExecutionResultParser } from "../runtime/parse-execution-result";
import {
  type AnyOperationSliceFragment,
  type AnyOperationSliceFragments,
  type ConcatSliceFragments,
  type ExecutionResultProjectionPathGraphNode,
  Operation,
  type OperationBuilder,
} from "../types/operation";
import type { AnyGraphqlRuntimeAdapter } from "../types/runtime";
import type { AnyGraphqlSchema, InputTypeRefs, OperationType } from "../types/schema";

import { buildDocument } from "./build-document";
import { createVarRefs } from "./input";

export const createOperationFactory = <TSchema extends AnyGraphqlSchema, TRuntimeAdapter extends AnyGraphqlRuntimeAdapter>() => {
  return <TOperationType extends OperationType>(operationType: TOperationType) => {
    return <
      TOperationName extends string,
      TSliceFragments extends AnyOperationSliceFragments,
      TVarDefinitions extends InputTypeRefs = {},
    >(
      options: {
        operationName: TOperationName;
        variables?: TVarDefinitions;
      },
      builder: OperationBuilder<TSchema, TVarDefinitions, TSliceFragments>,
    ) => {
      return Operation.create<TSchema, TRuntimeAdapter, TOperationType, TOperationName, TVarDefinitions, TSliceFragments>(() => {
        const { operationName } = options;
        const variables = (options.variables ?? {}) as TVarDefinitions;
        const $ = createVarRefs<TSchema, TVarDefinitions>(variables);
        const fragments = builder({ $ });

        const fields = Object.fromEntries(
          Object.entries(fragments).flatMap(([label, { getFields: fields }]) =>
            Object.entries(fields).map(([key, reference]) => [`${label}_${key}`, reference]),
          ),
        ) as ConcatSliceFragments<TSliceFragments>;

        return {
          operationType,
          operationName,
          variableNames: Object.keys(variables),
          projectionPathGraph: createPathGraphFromSliceEntries(fragments),
          document: buildDocument({
            operationName,
            operationType,
            variables,
            fields,
          }),
          parse: createExecutionResultParser({
            fragments,
            projectionPathGraph: createPathGraphFromSliceEntries(fragments),
          }),
        };
      });
    };
  };
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

function createPathGraphFromSliceEntries(fragments: { [key: string]: AnyOperationSliceFragment }) {
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
