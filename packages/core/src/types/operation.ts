/** Operation composition helpers (`gql.query`, `gql.mutation`, `gql.subscription`). */
import type { DocumentNode } from "graphql";
import type { GraphqlAdapter } from "./adapter";
import type { AnyOperationSlice } from "./operation-slice";
import type { AnyGraphqlSchema, OperationType } from "./schema";
import type { InputDefinition } from "./type-ref";
import type { EmptyObject } from "./utility";
import type { VariableReferencesByDefinition } from "./variables";

/**
 * Top-level operation builder that stitches multiple slices together and keeps
 * the resulting GraphQL document plus composite transform typed end-to-end.
 */
export type OperationFn<TSchema extends AnyGraphqlSchema, TAdapter extends GraphqlAdapter, TOperation extends OperationType> = <
  TName extends string,
  TSlices extends { [key: string]: AnyOperationSlice<TAdapter, TOperation> },
  TVariableDefinitions extends { [key: string]: InputDefinition } = EmptyObject,
>(
  name: TName,
  variables: TVariableDefinitions | null,
  builder: OperationBuilder<TSchema, TAdapter, TOperation, TVariableDefinitions, TSlices>,
) => {
  name: TName;
  document: DocumentNode;
  transform: (data: unknown) => {
    [K in keyof TSlices]: ReturnType<TSlices[K]["transform"]>;
  };
};

/** Builder invoked from userland to wire slices with operation-level variables. */
export type OperationBuilder<
  TSchema extends AnyGraphqlSchema,
  TAdapter extends GraphqlAdapter,
  TOperation extends OperationType,
  TVariables extends { [key: string]: InputDefinition },
  TSlices extends { [key: string]: AnyOperationSlice<TAdapter, TOperation> },
> = (tools: { $: NoInfer<VariableReferencesByDefinition<TSchema, TVariables>> }) => TSlices;
