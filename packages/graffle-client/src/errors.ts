/**
 * Errors that can occur outside of GraphQL execution
 * (network failures, client errors, etc.)
 */
export type GraffleClientError = NetworkError | ClientConfigError | UnknownError;

export type NetworkError = {
  code: "NETWORK_ERROR";
  message: string;
  cause?: unknown;
};

export type ClientConfigError = {
  code: "CLIENT_CONFIG_ERROR";
  message: string;
  cause?: unknown;
};

export type UnknownError = {
  code: "UNKNOWN_ERROR";
  message: string;
  cause?: unknown;
};

/**
 * Create a network error
 */
export const networkError = (message: string, cause?: unknown): NetworkError => ({
  code: "NETWORK_ERROR",
  message,
  cause,
});

/**
 * Create a client config error
 */
export const clientConfigError = (message: string, cause?: unknown): ClientConfigError => ({
  code: "CLIENT_CONFIG_ERROR",
  message,
  cause,
});

/**
 * Create an unknown error
 */
export const unknownError = (message: string, cause?: unknown): UnknownError => ({
  code: "UNKNOWN_ERROR",
  message,
  cause,
});

/**
 * Convert an unknown error to a GraffleClientError
 */
export const toGraffleClientError = (error: unknown): GraffleClientError => {
  if (error instanceof Error) {
    // Network errors from fetch or other transport layers
    if (error.name === "TypeError" || error.message.includes("fetch")) {
      return networkError(error.message, error);
    }
    return unknownError(error.message, error);
  }

  if (typeof error === "string") {
    return unknownError(error);
  }

  return unknownError("An unknown error occurred", error);
};

/**
 * Format a GraffleClientError for display
 */
export const formatGraffleClientError = (error: GraffleClientError): string => {
  return `[${error.code}] ${error.message}`;
};
