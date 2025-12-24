import type { FormattedExecutionResult, GraphQLFormattedError } from "graphql";

/**
 * Generic non-GraphQL error type for framework-specific errors.
 * Users can define their own error shape.
 */
export type NonGraphqlError = unknown;

/**
 * Normalized execution result representing all possible outcomes
 * from a GraphQL operation.
 */
export type NormalizedExecutionResult<TData, TExtensions> =
  | EmptyResult
  | GraphqlExecutionResult<TData, TExtensions>
  | NonGraphqlErrorResult;

export type EmptyResult = {
  type: "empty";
};

export type GraphqlExecutionResult<TData, TExtensions> = {
  type: "graphql";
  body: FormattedExecutionResult<TData, TExtensions>;
};

export type NonGraphqlErrorResult = {
  type: "non-graphql-error";
  error: NonGraphqlError;
};

/**
 * Error types that can occur during slice result processing.
 */
export type NormalizedError =
  | {
      type: "graphql-error";
      errors: GraphQLFormattedError[];
    }
  | {
      type: "non-graphql-error";
      error: NonGraphqlError;
    }
  | {
      type: "parse-error";
      errors: Error[];
    };
