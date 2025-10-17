import type { AnyGraphqlRuntimeAdapter } from "@soda-gql/core/runtime";
import type { GraffleClientError } from "./errors";

/**
 * Runtime adapter for graffle-client
 * Defines the error type used for non-GraphQL errors
 */
export type GraffleRuntimeAdapter = {
  nonGraphqlErrorType: () => GraffleClientError;
};

/**
 * Type guard to check if an adapter is a GraffleRuntimeAdapter
 */
export const isGraffleRuntimeAdapter = (adapter: AnyGraphqlRuntimeAdapter): adapter is GraffleRuntimeAdapter => {
  return typeof adapter === "object" && "nonGraphqlErrorType" in adapter;
};

/**
 * Minimal GraphQL client interface
 * Compatible with graphql-request and can be adapted for other clients
 */
export type GraphQLClient = {
  request<TData = unknown, TVariables = Record<string, unknown>>(
    document: string,
    variables?: TVariables,
    requestHeaders?: HeadersInit,
  ): Promise<TData>;
};

/**
 * Configuration for the executor
 */
export type ExecutorConfig = {
  /**
   * The GraphQL client instance
   */
  client: GraphQLClient;

  /**
   * Optional request headers to include with every request
   */
  headers?: HeadersInit;

  /**
   * Optional request context that will be passed to the client
   */
  context?: unknown;
};

/**
 * Options for executing an operation
 */
export type ExecuteOptions = {
  /**
   * Additional headers for this specific request
   */
  headers?: HeadersInit;

  /**
   * Request-specific context
   */
  context?: unknown;
};
