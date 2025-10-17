import { createRuntimeAdapter } from "@soda-gql/core/runtime";
import type { GraffleClientError } from "./errors";
import type { GraffleRuntimeAdapter } from "./types";

/**
 * Create a runtime adapter for graffle-client
 * This adapter defines how non-GraphQL errors are typed in the execution results
 */
export const createGraffleRuntimeAdapter = (): GraffleRuntimeAdapter => {
  return createRuntimeAdapter(({ type }) => ({
    nonGraphqlErrorType: type<GraffleClientError>(),
  }));
};
