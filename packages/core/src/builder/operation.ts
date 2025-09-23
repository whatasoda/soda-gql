import type {
  AnyGraphqlSchema,
  AnyOperationSlice,
  AnySliceResultRecord,
  EmptyObject,
  GraphqlAdapter,
  InputTypeRefs,
  OperationBuilder,
  OperationFn,
  OperationType,
} from "../types";
import { buildDocument } from "./document-builder";
import { createVariableReferences } from "./input";

export const createOperationFactory =
  <TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter>(_schema: TSchema, _adapter: TAdapter) =>
  <TOperation extends OperationType>(operation: TOperation): OperationFn<TSchema, TAdapter, TOperation> => {
    const operationFn: OperationFn<TSchema, TAdapter, TOperation> = <
      TName extends string,
      TSlices extends { [key: string]: AnyOperationSlice<TAdapter, TOperation> },
      TVariableDefinitions extends InputTypeRefs = EmptyObject,
    >(
      name: TName,
      variablesDefinitions: TVariableDefinitions | null,
      builder: OperationBuilder<TSchema, TAdapter, TOperation, TVariableDefinitions, TSlices>,
    ) => {
      const variables = (variablesDefinitions ?? {}) as TVariableDefinitions;
      const $ = createVariableReferences<TSchema, TVariableDefinitions>(variables);
      const slices = builder({ $ });

      const fields = Object.entries(slices).flatMap(([label, slice]) =>
        Object.entries(slice.object).map(([key, reference]) => ({ labeledKey: `${label}_${key}`, key, reference })),
      );

      const document = buildDocument({
        name,
        operation,
        variables,
        fields: Object.fromEntries(fields.map(({ labeledKey, reference }) => [labeledKey, reference])),
      });

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
        document,
        transform,
        variables,
        slices,
      };
    };

    return operationFn;
  };
