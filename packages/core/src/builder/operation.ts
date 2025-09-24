import { DocumentNode } from "graphql";
import {
  hidden,
  Operation,
  type AnyGraphqlSchema,
  type AnyOperationSlice,
  type EmptyObject,
  type GraphqlAdapter,
  type InputTypeRefs,
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

      const operation: Operation<TSchema, TAdapter, TOperationType, TName, TVariableDefinitions, TSlices> = {
        _input: hidden(),
        _raw: hidden(),
        _output: hidden(),
        type: operationType,
        name,
        document: document as Operation<TSchema, TAdapter, TOperationType, TName, TVariableDefinitions, TSlices>["document"],
        parse: hidden(),
      };

      return operation;
    };

    return operationFn;
  };
