import type { DocumentNode } from "graphql";
import type { GraphqlAdapter } from "./adapter";
import type { AnyOperationSlice } from "./operation-slice";
import type { AnyGraphqlSchema, OperationType } from "./schema";
import type { InputDefinition } from "./type-ref";
import type { EmptyObject } from "./utility";
import type { VariableReferencesByDefinition } from "./variables";

export type OperationFn<TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter, TOperation extends OperationType> = <
  TName extends string,
  TSlices extends { [key: string]: AnyOperationSlice<TAdapter, TOperation> },
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
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperation extends OperationType,
  TVariables extends { [key: string]: InputDefinition },
  TSlices extends { [key: string]: AnyOperationSlice<TAdapter, TOperation> },
> = (tools: { $: NoInfer<VariableReferencesByDefinition<TSchema, TVariables>> }) => TSlices;
