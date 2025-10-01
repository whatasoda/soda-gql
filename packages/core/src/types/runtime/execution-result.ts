import type { FormattedExecutionResult, GraphQLFormattedError } from "graphql";
import type { AnyGraphqlRuntimeAdapter } from "./runtime-adapter";

export type NormalizedExecutionResult<TRuntimeAdapter extends AnyGraphqlRuntimeAdapter, TData, TExtensions> =
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

export type NonGraphqlErrorResult<TRuntimeAdapter extends AnyGraphqlRuntimeAdapter> = {
  type: "non-graphql-error";
  error: ReturnType<TRuntimeAdapter["nonGraphqlErrorType"]>;
};

export type NormalizedError<TRuntimeAdapter extends AnyGraphqlRuntimeAdapter> =
  | {
      type: "graphql-error";
      errors: GraphQLFormattedError[];
    }
  | {
      type: "non-graphql-error";
      error: ReturnType<TRuntimeAdapter["nonGraphqlErrorType"]>;
    }
  | {
      type: "parse-error";
      errors: Error[];
    };
