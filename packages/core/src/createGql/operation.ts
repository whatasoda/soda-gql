import { type DocumentNode, Kind } from "graphql";
import type {
  AnyGraphqlSchema,
  AnyOperationSlice,
  AnySliceResultRecord,
  EmptyObject,
  GraphqlAdapter,
  InputDefinition,
  OperationBuilder,
  OperationFn,
  OperationType,
} from "../types";
import { createVariableAssignments } from "./variables";

const createDocumentStub = (): DocumentNode => ({
  kind: Kind.DOCUMENT,
  definitions: [],
});

export const createOperationFactory =
  <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>(_schema: TSchema, _adapter: TAdapter) =>
  <TOperation extends OperationType>(_operation: TOperation): OperationFn<TSchema, TAdapter, TOperation> => {
    const operationFn: OperationFn<TSchema, TAdapter, TOperation> = <
      TName extends string,
      TSlices extends { [key: string]: AnyOperationSlice<TAdapter, TOperation> },
      TVariableDefinitions extends { [key: string]: InputDefinition } = EmptyObject,
    >(
      name: TName,
      variablesDefinitions: TVariableDefinitions | null,
      builder: OperationBuilder<TSchema, TAdapter, TOperation, TVariableDefinitions, TSlices>,
    ) => {
      const variables = (variablesDefinitions ?? {}) as TVariableDefinitions;
      const $ = createVariableAssignments<TSchema, TVariableDefinitions>(variables, {} as EmptyObject);
      const slices = builder({ $ });

      const transform = (data: unknown) => {
        const records = (
          typeof data === "object" && data !== null ? (data as AnySliceResultRecord<TAdapter>) : {}
        ) satisfies AnySliceResultRecord<TAdapter>;

        const entries = Object.entries(slices).map(([key, slice]) => {
          return [key, slice.transform({ prefix: key, results: records })] as const;
        });

        return Object.fromEntries(entries) as {
          [K in keyof typeof slices]: ReturnType<(typeof slices)[K]["transform"]>;
        };
      };

      return {
        name,
        document: createDocumentStub() as DocumentNode,
        transform,
        variables,
        slices,
      };
    };

    return operationFn;
  };
