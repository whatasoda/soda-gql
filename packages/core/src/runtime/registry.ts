import type {
  AnyGraphqlSchema,
  AnyOperationSlices,
  GraphqlRuntimeAdapter,
  InputTypeRefs,
  Operation,
  OperationType,
} from "../types";

const registry = new Map<
  string,
  Operation<
    AnyGraphqlSchema,
    GraphqlRuntimeAdapter,
    OperationType,
    string,
    InputTypeRefs,
    AnyOperationSlices<AnyGraphqlSchema, GraphqlRuntimeAdapter, OperationType>
  >
>();

export const registerOperation = (
  operation: Operation<
    AnyGraphqlSchema,
    GraphqlRuntimeAdapter,
    OperationType,
    string,
    InputTypeRefs,
    AnyOperationSlices<AnyGraphqlSchema, GraphqlRuntimeAdapter, OperationType>
  >,
) => {
  if (registry.has(operation.name)) {
    throw new Error(`Operation ${operation.name} already registered`);
  }
  registry.set(operation.name, operation);
};

export const getOperation = (name: string) => {
  const operation = registry.get(name);
  if (!operation) {
    throw new Error(`Operation ${name} not found`);
  }
  return operation;
};
