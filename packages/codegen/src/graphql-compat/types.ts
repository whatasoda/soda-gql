/**
 * Types for graphql-compat code generation.
 * Transforms .graphql operation files to TypeScript compat pattern.
 * @module
 */

/**
 * Options for running graphql-compat code generation.
 */
export type GraphqlCompatOptions = {
  /** Schema name from config */
  readonly schemaName: string;
  /** Resolved paths to .graphql operation files */
  readonly operationFiles: readonly string[];
  /** Output directory for generated files */
  readonly outputDir?: string;
  /** Import path for graphql-system module (e.g., "@/graphql-system") */
  readonly graphqlSystemPath: string;
};

/**
 * Parsed GraphQL operation (query, mutation, subscription).
 */
export type ParsedOperation = {
  readonly kind: "query" | "mutation" | "subscription";
  readonly name: string;
  readonly variables: readonly ParsedVariable[];
  readonly selections: readonly ParsedSelection[];
  readonly sourceFile: string;
};

/**
 * Parsed GraphQL fragment definition.
 */
export type ParsedFragment = {
  readonly name: string;
  readonly onType: string;
  readonly selections: readonly ParsedSelection[];
  readonly sourceFile: string;
};

/**
 * Inferred variable from fragment field arguments.
 * Unlike ParsedVariable which comes from explicit declaration,
 * this is derived from variable usages in field arguments.
 */
export type InferredVariable = {
  /** Variable name (without $) */
  readonly name: string;
  /** Type name (e.g., "ID", "String", "UserInput") */
  readonly typeName: string;
  /** Type modifier in soda-gql format */
  readonly modifier: string;
  /** Type kind (scalar, enum, or input) */
  readonly typeKind: "scalar" | "enum" | "input";
};

/**
 * Parsed variable definition from a GraphQL operation.
 */
export type ParsedVariable = {
  /** Variable name (without $) */
  readonly name: string;
  /** Type name (e.g., "ID", "String", "UserInput") */
  readonly typeName: string;
  /**
   * Type modifier in soda-gql format.
   * Format: inner nullability + list modifiers
   * - Inner: `!` (non-null) or `?` (nullable)
   * - List: `[]!` (non-null list) or `[]?` (nullable list)
   *
   * Examples:
   * - `ID!` → `"!"`
   * - `[ID!]!` → `"![]!"`
   * - `[ID]` → `"?[]?"`
   */
  readonly modifier: string;
  /** Type kind (scalar, enum, or input) */
  readonly typeKind: "scalar" | "enum" | "input";
  /** Default value if specified */
  readonly defaultValue?: ParsedValue;
};

/**
 * Parsed selection from a SelectionSet.
 */
export type ParsedSelection = ParsedFieldSelection | ParsedFragmentSpread | ParsedInlineFragment;

/**
 * Parsed field selection.
 */
export type ParsedFieldSelection = {
  readonly kind: "field";
  readonly name: string;
  readonly alias?: string;
  readonly arguments?: readonly ParsedArgument[];
  /** Nested selections if field returns object type */
  readonly selections?: readonly ParsedSelection[];
};

/**
 * Parsed fragment spread (...FragmentName).
 */
export type ParsedFragmentSpread = {
  readonly kind: "fragmentSpread";
  readonly name: string;
};

/**
 * Parsed inline fragment (... on Type { }).
 */
export type ParsedInlineFragment = {
  readonly kind: "inlineFragment";
  readonly onType: string;
  readonly selections: readonly ParsedSelection[];
};

/**
 * Parsed argument for a field.
 */
export type ParsedArgument = {
  readonly name: string;
  readonly value: ParsedValue;
};

/**
 * Parsed value (can be literal or variable reference).
 */
export type ParsedValue =
  | { readonly kind: "variable"; readonly name: string }
  | { readonly kind: "int"; readonly value: string }
  | { readonly kind: "float"; readonly value: string }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "null" }
  | { readonly kind: "enum"; readonly value: string }
  | { readonly kind: "list"; readonly values: readonly ParsedValue[] }
  | { readonly kind: "object"; readonly fields: readonly ParsedObjectField[] };

/**
 * Parsed object field in an object value.
 */
export type ParsedObjectField = {
  readonly name: string;
  readonly value: ParsedValue;
};

/**
 * Result of parsing a .graphql file.
 */
export type ParseResult = {
  readonly operations: readonly ParsedOperation[];
  readonly fragments: readonly ParsedFragment[];
};

/**
 * Generated file output.
 */
export type GeneratedFile = {
  readonly path: string;
  readonly content: string;
};

/**
 * Error types for graphql-compat operations.
 */
export type GraphqlCompatError =
  | {
      readonly code: "GRAPHQL_FILE_NOT_FOUND";
      readonly message: string;
      readonly filePath: string;
    }
  | {
      readonly code: "GRAPHQL_PARSE_ERROR";
      readonly message: string;
      readonly filePath: string;
      readonly line?: number;
      readonly column?: number;
    }
  | {
      readonly code: "GRAPHQL_INVALID_OPERATION";
      readonly message: string;
      readonly operationName?: string;
    }
  | {
      readonly code: "GRAPHQL_UNKNOWN_TYPE";
      readonly message: string;
      readonly typeName: string;
    }
  | {
      readonly code: "GRAPHQL_FRAGMENT_NOT_FOUND";
      readonly message: string;
      readonly fragmentName: string;
    }
  | {
      readonly code: "GRAPHQL_OUTPUT_ERROR";
      readonly message: string;
      readonly outputPath: string;
    }
  | {
      readonly code: "GRAPHQL_INLINE_FRAGMENT_ON_INTERFACE";
      readonly message: string;
      readonly onType: string;
    }
  | {
      readonly code: "GRAPHQL_UNDECLARED_VARIABLE";
      readonly message: string;
      readonly variableName: string;
    }
  | {
      readonly code: "GRAPHQL_INLINE_FRAGMENT_WITHOUT_TYPE";
      readonly message: string;
    }
  | {
      readonly code: "GRAPHQL_VARIABLE_TYPE_MISMATCH";
      readonly message: string;
      readonly variableName: string;
    }
  | {
      readonly code: "GRAPHQL_VARIABLE_MODIFIER_INCOMPATIBLE";
      readonly message: string;
      readonly variableName: string;
    }
  | {
      readonly code: "GRAPHQL_FRAGMENT_CIRCULAR_DEPENDENCY";
      readonly message: string;
      readonly fragmentNames: readonly string[];
    }
  | {
      readonly code: "GRAPHQL_UNKNOWN_FIELD";
      readonly message: string;
      readonly typeName: string;
      readonly fieldName: string;
    }
  | {
      readonly code: "GRAPHQL_UNKNOWN_ARGUMENT";
      readonly message: string;
      readonly fieldName: string;
      readonly argumentName: string;
    };
