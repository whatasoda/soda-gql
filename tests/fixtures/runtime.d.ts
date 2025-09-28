// Actual runtime API declarations based on packages/core/src/runtime/index.ts
// This provides accurate types without the complex generic issues in the source

declare module "@soda-gql/runtime" {
  export type DocumentNode = any;

  export namespace graphql {
    export type DocumentNode = any;
  }

  export type graphql = any;

  type Model<T = any> = {
    _input: any;
    _output: any;
    typename: string;
    fragment: (...args: any[]) => any;
    transform: (raw: any) => T;
  };

  type OperationSlice = (variables?: any) => {
    _output: any;
    operationType: string;
    variables: any;
    getFields: any;
    rootFieldKeys: readonly string[];
    projections: any;
  };

  export const gqlRuntime: {
    model: (config: {
      typename: string;
      transform: (raw: any) => any;
    }) => Model;

    query: (config: {
      name: string;
      document: any;
      variableNames: readonly string[];
      getSlices: (...args: any[]) => any;
      projectionPathGraph?: any;
    }) => any;

    mutation: (config: any) => any;
    subscription: (config: any) => any;

    querySlice: (config: {
      rootFieldKeys: readonly string[];
      projections: any;
    }) => OperationSlice;

    mutationSlice: (config: {
      rootFieldKeys: readonly string[];
      projections: any;
    }) => OperationSlice;

    subscriptionSlice: (config: {
      rootFieldKeys: readonly string[];
      projections: any;
    }) => OperationSlice;

    handleProjectionBuilder: <T>(builder: T) => any;
  };
}

declare module "@/graphql-runtime" {
  export * from "@soda-gql/runtime";
}