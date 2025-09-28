// Simplified runtime types for type-checking transformed code
// This provides the API shape without complex generic depth issues

declare module "@soda-gql/runtime" {
  export type DocumentNode = any;

  export namespace graphql {
    export type DocumentNode = any;
  }

  export type graphql = any;

  // Simplified runtime API that matches what the transformed code expects
  export const gqlRuntime: {
    model: (config: {
      typename: string;
      transform: (raw: any) => any;
    }) => any;

    query: (config: {
      name: string;
      document: any;
      projectionPathGraph: {
        matches: Array<{ label: string; path: string; exact: boolean }>;
        children: Record<string, any>;
      };
      variableNames: readonly string[];
      getSlices: (...args: any[]) => any;
    }) => any;

    mutation: (config: any) => any;
    subscription: (config: any) => any;

    querySlice: (config: {
      rootFieldKeys: readonly string[];
      projections: any;
    }) => any;

    mutationSlice: (config: {
      rootFieldKeys: readonly string[];
      projections: any;
    }) => any;

    subscriptionSlice: (config: {
      rootFieldKeys: readonly string[];
      projections: any;
    }) => any;

    handleProjectionBuilder: <T>(builder: T) => any;
  };
}

declare module "@/graphql-runtime" {
  export * from "@soda-gql/runtime";
}