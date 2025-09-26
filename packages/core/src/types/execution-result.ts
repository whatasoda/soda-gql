import type { FormattedExecutionResult, GraphQLFormattedError } from "graphql";
import type { GraphqlRuntimeAdapter } from "./adapter";

export type NormalizedExecutionResult<TRuntimeAdapter extends GraphqlRuntimeAdapter, TData, TExtensions> =
  | EmptyResult
  | GraphqlExecutionResult<TData, TExtensions>
  | NonGraphqlErrorResult<TRuntimeAdapter>;

export type EmptyResult = {
  type: "empty";
};

export type GraphqlExecutionResult<TData, TExtensions> = {
  type: "graphql";
  body: FormattedExecutionResult<TData, TExtensions>;
};

export type NonGraphqlErrorResult<TRuntimeAdapter extends GraphqlRuntimeAdapter> = {
  type: "non-graphql-error";
  error: ReturnType<TRuntimeAdapter["createError"]>;
};

export type NormalizedError<TRuntimeAdapter extends GraphqlRuntimeAdapter> =
  | {
      type: "graphql-error";
      errors: GraphQLFormattedError[];
    }
  | {
      type: "non-graphql-error";
      error: ReturnType<TRuntimeAdapter["createError"]>;
    }
  | {
      type: "parse-error";
      error: Error;
    };
