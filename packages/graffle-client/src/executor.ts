import type { AnyComposedOperation } from "@soda-gql/core";
import { gqlRuntime } from "@soda-gql/core/runtime";
import { print } from "graphql";
import { err, ok, type Result } from "neverthrow";
import { clientConfigError, type GraffleClientError } from "./errors";
import { executeAndNormalize } from "./normalizer";
import type { ExecuteOptions, ExecutorConfig } from "./types";

/**
 * Execute a GraphQL operation using the provided client
 *
 * @param config - Executor configuration (client, headers, context)
 * @param operation - The operation to execute
 * @param variables - Variables for the operation
 * @param options - Additional execution options
 * @returns Result containing the parsed operation data or a client error
 */
export const executeOperation = async <
  TOperation extends AnyComposedOperation,
  TVariables extends Record<string, unknown>,
  TProjectedData extends object,
>(
  config: ExecutorConfig,
  operation: TOperation,
  variables: TVariables,
  options?: ExecuteOptions,
): Promise<Result<TProjectedData, GraffleClientError>> => {
  try {
    // Print the document to a string for the client
    const documentString = print(operation.document);

    // Merge headers from config and options
    const headers = {
      ...config.headers,
      ...options?.headers,
    };

    // Execute the request and normalize the response
    const normalizedResult = await executeAndNormalize(async () => {
      return await config.client.request(documentString, variables, headers);
    });

    // Parse the normalized result using the operation's parser
    const parsedData = operation.parse(normalizedResult) as TProjectedData;

    return ok(parsedData);
  } catch (error) {
    // This should rarely happen since executeAndNormalize catches errors,
    // but we handle it for completeness
    return err(clientConfigError(error instanceof Error ? error.message : "Failed to execute operation", error));
  }
};

/**
 * Execute a GraphQL operation by its registered name
 *
 * @param config - Executor configuration (client, headers, context)
 * @param operationName - The name of the registered operation
 * @param variables - Variables for the operation
 * @param options - Additional execution options
 * @returns Result containing the parsed operation data or a client error
 */
export const executeOperationByName = async <TVariables extends Record<string, unknown>, TProjectedData extends object>(
  config: ExecutorConfig,
  operationName: string,
  variables: TVariables,
  options?: ExecuteOptions,
): Promise<Result<TProjectedData, GraffleClientError>> => {
  try {
    // Get the operation from the runtime registry
    const operation = gqlRuntime.getOperation(operationName) as AnyComposedOperation;

    // Execute the operation
    return await executeOperation(config, operation, variables, options);
  } catch (error) {
    return err(clientConfigError(error instanceof Error ? error.message : `Failed to get operation: ${operationName}`, error));
  }
};

/**
 * Create an executor function bound to a specific configuration
 *
 * This is a convenience function that creates a closure over the config,
 * allowing you to call operations without passing the config each time.
 *
 * @param config - Executor configuration (client, headers, context)
 * @returns An object with execute and executeByName methods
 */
export const createExecutor = (config: ExecutorConfig) => {
  return {
    /**
     * Execute an operation
     */
    execute: <TOperation extends AnyComposedOperation, TVariables extends Record<string, unknown>, TProjectedData extends object>(
      operation: TOperation,
      variables: TVariables,
      options?: ExecuteOptions,
    ) => executeOperation<TOperation, TVariables, TProjectedData>(config, operation, variables, options),

    /**
     * Execute an operation by name
     */
    executeByName: <TVariables extends Record<string, unknown>, TProjectedData extends object>(
      operationName: string,
      variables: TVariables,
      options?: ExecuteOptions,
    ) => executeOperationByName<TVariables, TProjectedData>(config, operationName, variables, options),
  };
};
