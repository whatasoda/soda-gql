import type { NormalizedExecutionResult } from "@soda-gql/core/runtime";
import type { FormattedExecutionResult } from "graphql";
import { toGraffleClientError } from "./errors";
import type { GraffleRuntimeAdapter } from "./types";

/**
 * Normalize a GraphQL response into a NormalizedExecutionResult
 *
 * This function handles three cases:
 * 1. Successful GraphQL response (may include GraphQL errors)
 * 2. Transport/network errors (thrown by the client)
 * 3. Empty responses
 */
export const normalizeGraphQLResponse = <TData extends object, TExtensions extends object>(
  responseOrError: FormattedExecutionResult<TData, TExtensions> | Error | unknown,
): NormalizedExecutionResult<GraffleRuntimeAdapter, TData, TExtensions> => {
  // Handle errors thrown by the client (network, timeout, etc.)
  if (responseOrError instanceof Error) {
    const clientError = toGraffleClientError(responseOrError);
    return {
      type: "non-graphql-error",
      error: clientError,
    };
  }

  // Handle unknown error types (not a proper response object)
  if (typeof responseOrError !== "object" || responseOrError === null) {
    const clientError = toGraffleClientError(responseOrError);
    return {
      type: "non-graphql-error",
      error: clientError,
    };
  }

  // Check if it looks like a GraphQL response (has data or errors properties)
  const maybeResponse = responseOrError as Record<string, unknown>;
  if (!("data" in maybeResponse) && !("errors" in maybeResponse)) {
    // Not a valid GraphQL response, treat as error
    const clientError = toGraffleClientError(responseOrError);
    return {
      type: "non-graphql-error",
      error: clientError,
    };
  }

  const response = responseOrError as FormattedExecutionResult<TData, TExtensions>;

  // Handle empty responses (no data and no errors)
  if (!response.data && (!response.errors || response.errors.length === 0)) {
    return {
      type: "empty",
    };
  }

  // Handle GraphQL responses (includes both successful and error responses)
  return {
    type: "graphql",
    body: response,
  };
};

/**
 * Execute a GraphQL request and normalize the response
 *
 * This function wraps the client request and catches any errors,
 * converting them into normalized execution results.
 */
export const executeAndNormalize = async <TData extends object, TExtensions extends object>(
  executor: () => Promise<FormattedExecutionResult<TData, TExtensions>>,
): Promise<NormalizedExecutionResult<GraffleRuntimeAdapter, TData, TExtensions>> => {
  try {
    const response = await executor();
    return normalizeGraphQLResponse<TData, TExtensions>(response);
  } catch (error) {
    return normalizeGraphQLResponse<TData, TExtensions>(error);
  }
};
