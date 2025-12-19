/**
 * Base metadata types that can be attached to operations.
 * These are consumed at runtime by GraphQL clients for HTTP headers,
 * extensions, and custom application-specific values.
 */
export type OperationMetadata = {
  /** HTTP headers to include with the GraphQL request */
  readonly headers?: Record<string, string>;
  /** GraphQL extensions to include in the request payload */
  readonly extensions?: Record<string, unknown>;
  /** Custom arbitrary metadata values for application-specific use */
  readonly custom?: Record<string, unknown>;
};

/**
 * Slice-specific metadata that can contribute to operation metadata.
 * Includes additional fields for common slice-level concerns like
 * authentication requirements and cache control.
 */
export type SliceMetadata = OperationMetadata & {
  /** Indicates if this slice requires authentication */
  readonly requiresAuth?: boolean;
  /** Cache TTL in seconds for this slice's data */
  readonly cacheTtl?: number;
};

/**
 * Utility type to extract the metadata type from an operation or slice.
 */
export type ExtractMetadata<T> = T extends { metadata: infer M } ? M : OperationMetadata;
