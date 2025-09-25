import type { DocumentNode } from "graphql";
import {
  type AnyAssignableInput,
  type AnyGraphqlSchema,
  type AnyOperationSlices,
  type ExecutionResultProjectionPathGraph,
  type GraphqlAdapter,
  hidden,
  type OperationType,
} from "../types";

type GeneratedOperation = {
  name: string;
  document: DocumentNode;
  projectionPathGraph: ExecutionResultProjectionPathGraph;
  getSlices: (tools: { $: AnyAssignableInput }) => AnyOperationSlices<AnyGraphqlSchema, GraphqlAdapter, OperationType>;
};

export const runtimeOperation = (operationType: OperationType) => (generated: GeneratedOperation) => ({
  _input: hidden(),
  _raw: hidden(),
  _output: hidden(),
  type: operationType,
  name: generated.name,
  document: generated.document,
  projectionPathGraph: generated.projectionPathGraph,
  parse: hidden(), // TODO: implement
});
