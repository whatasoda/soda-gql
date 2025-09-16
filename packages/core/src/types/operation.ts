import type { DocumentNode } from "graphql";
import type { GraphqlAdapter } from "./adapter";
import type { ArgumentAssignments } from "./arguments";
import type { AbstractOperationSlice } from "./operation-slice";
import type { GraphqlSchema, OperationType } from "./schema";
import type { InputDefinition } from "./type-ref";
import type { EmptyObject } from "./utility";

export type OperationFn<TSchema extends GraphqlSchema, TAdapter extends GraphqlAdapter, TOperation extends OperationType> = <
  TName extends string,
  TSlices extends { [key: string]: AbstractOperationSlice<TSchema, TAdapter, TOperation> },
  TVariables extends { [key: string]: InputDefinition } = EmptyObject,
>(
  name: TName,
  variables: TVariables | null,
  builder: OperationBuilder<TSchema, TAdapter, TOperation, TVariables, TSlices>,
) => {
  name: TName;
  document: DocumentNode;
  transform: (data: unknown) => {
    [K in keyof TSlices]: ReturnType<TSlices[K]["transform"]>;
  };
};

type OperationBuilder<
  TSchema extends GraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperation extends OperationType,
  TVariables extends { [key: string]: InputDefinition },
  TSlices extends { [key: string]: AbstractOperationSlice<TSchema, TAdapter, TOperation> },
> = (tools: { $: NoInfer<ArgumentAssignments<TSchema, TVariables>> }) => TSlices;
