/**
 * Callback Builder-Only Features Documentation
 *
 * This file documents GraphQL features that REQUIRE callback builder syntax
 * and CANNOT be expressed with tagged template syntax.
 *
 * Each section includes:
 * - Explanation of why tagged templates cannot express the feature
 * - Conceptual examples (some features not available in playground due to API changes)
 * - References to relevant tests or documentation
 *
 * Note: This playground uses tagged template-first API. Some callback builder
 * features (like fragment callback builders) were removed in Phase 3 refactor.
 * See packages/core/test for working callback builder examples.
 */

import { gql } from "@/graphql-system";
import { employeeFragment } from "./fragments";

// ============================================================================
// 1. Field Aliases
// ============================================================================
// Why tagged templates can't express this:
// Tagged templates parse static GraphQL strings. Field aliases require runtime
// configuration through the field factory's second parameter ({ alias: "..." }).
// This dynamic parameter cannot be represented in a static GraphQL string.
//
// GraphQL spec allows aliases in string syntax: `userId: id`, but this would
// require parsing and modifying the AST at runtime, which contradicts the
// tagged template's goal of static string parsing.

/**
 * Field alias example (callback builder - see packages/core/test/types/alias-handling.test.ts)
 *
 * @example
 * ```typescript
 * const GetUser = gql(({ query, $var }) =>
 *   query.operation({
 *     name: "GetUser",
 *     variables: { ...$var("id").ID("!") },
 *     fields: ({ f, $ }) => ({
 *       ...f.user({ id: $.id })(({ f }) => ({
 *         // Use alias option: f.field(args, { alias: "newName" })
 *         ...f.id(null, { alias: "userId" }),
 *         ...f.name(null, { alias: "userName" }),
 *       })),
 *     }),
 *   }),
 * );
 *
 * // Type inference with aliases
 * type Output = typeof GetUser.$infer.output;
 * // Output type: { user: { userId: string; userName: string } | null }
 * ```
 *
 * Reference: packages/core/test/types/alias-handling.test.ts
 */

// ============================================================================
// 2. Fragment Spreads in Operations
// ============================================================================
// Why tagged templates can't express this:
// Tagged templates REJECT all interpolated expressions to maintain static
// GraphQL string parsing. Fragment spreads in operations require interpolation
// (e.g., ...${fragment}) which triggers "Tagged templates must not contain
// interpolated expressions" error. Only fragment-to-fragment spreading supports
// interpolation.

/**
 * WORKING EXAMPLE: Operation spreading a fragment with explicit variable passing
 * Demonstrates the .spread() method for fragment composition in operations
 * This example uses callback builder syntax for operations (query.operation)
 * while fragments use tagged templates
 */
export const getEmployeeWithFragmentCallbackQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetEmployeeWithFragmentCallback",
    variables: {
      ...$var("employeeId").ID("!"),
      ...$var("taskLimit").Int("?"),
    },
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(() => ({
        // Use .spread() to include fragment fields
        // Pass variables explicitly - no auto-merge
        ...employeeFragment.spread({ taskLimit: $.taskLimit }),
      })),
    }),
  }),
);

/**
 * Note: The above example demonstrates that callback builder operations
 * can spread tagged template fragments. The key limitation is:
 * - Tagged template OPERATIONS cannot spread fragments (reject interpolation)
 * - Callback builder OPERATIONS can spread fragments (via .spread())
 * - Tagged template FRAGMENTS can spread other fragments (via ...${frag})
 *
 * For multiple fragment spreads, see operations.ts where we demonstrate
 * spreading multiple fragments with explicit variable declaration.
 */

// ============================================================================
// 3. Operation-Level Metadata Callbacks
// ============================================================================
// Why tagged templates can't express this:
// While tagged templates support static metadata and metadata callbacks
// (via the options parameter), the VISION incorrectly assumed operation-level
// metadata callbacks were callback-builder-only. Actually, both syntaxes
// support metadata callbacks.
//
// However, metadata callbacks with fragmentMetadata parameter are more
// commonly used in callback builder syntax where fragment spreading is explicit.

/**
 * Operation with metadata callback accessing fragmentMetadata
 * Demonstrates aggregating metadata from spread fragments
 */
export const getEmployeeWithMetadataAggregationQuery = gql.default(({ query, $var }) =>
  query.operation({
    name: "GetEmployeeWithMetadataAggregation",
    variables: { ...$var("employeeId").ID("!"), ...$var("taskLimit").Int("?") },
    metadata: ({ $, fragmentMetadata }) => ({
      operationType: "read",
      entityId: $.employeeId,
      // Aggregate cache hints from all spread fragments
      maxCacheTTL: Math.max(0, ...(fragmentMetadata?.map((meta) => (meta as { cacheTTL?: number }).cacheTTL ?? 0) ?? [])),
      fragmentCount: fragmentMetadata?.length ?? 0,
    }),
    fields: ({ f, $ }) => ({
      ...f.employee({ id: $.employeeId })(() => ({
        ...employeeFragment.spread({ taskLimit: $.taskLimit }),
      })),
    }),
  }),
);

// ============================================================================
// 4. Document Transforms
// ============================================================================
// Why tagged templates can't express this:
// Document transforms operate at the adapter level, modifying the GraphQL AST
// before execution. While both tagged templates and callback builders produce
// documents that can be transformed, document transforms require defineAdapter
// configuration which is separate from element definition syntax.
//
// This is NOT a syntax limitation - it's an architectural feature that applies
// to both syntaxes. However, it's commonly associated with callback builders
// in documentation because advanced features (like transforms) are often paired
// with other callback-builder-only features.

/**
 * Example: Document transform configuration (applies to both syntaxes)
 * This would be defined in a separate adapter file, not in element definitions
 *
 * @example
 * ```typescript
 * import { defineAdapter } from "@soda-gql/core";
 * import { visit, Kind } from "graphql";
 *
 * const cacheAdapter = defineAdapter({
 *   helpers: {
 *     cache: {
 *       hint: (seconds: number) => ({ cacheHint: seconds }),
 *     },
 *   },
 *   metadata: {
 *     aggregateFragmentMetadata: (fragments) => ({
 *       maxCacheHint: Math.max(0, ...fragments.map(f => f.metadata?.cacheHint ?? 0)),
 *     }),
 *   },
 *   transformDocument: ({ document, fragmentMetadata }) => {
 *     const cacheHint = fragmentMetadata?.maxCacheHint || 0;
 *     if (cacheHint > 0) {
 *       return visit(document, {
 *         OperationDefinition: (node) => ({
 *           ...node,
 *           directives: [
 *             ...(node.directives ?? []),
 *             {
 *               kind: Kind.DIRECTIVE,
 *               name: { kind: Kind.NAME, value: "cacheControl" },
 *               arguments: [
 *                 {
 *                   kind: Kind.ARGUMENT,
 *                   name: { kind: Kind.NAME, value: "maxAge" },
 *                   value: { kind: Kind.INT, value: String(cacheHint) },
 *                 },
 *               ],
 *             },
 *           ],
 *         }),
 *       });
 *     }
 *     return document;
 *   },
 * });
 * ```
 */

// ============================================================================
// 5. $colocate Pattern
// ============================================================================
// Why tagged templates can't express this:
// The $colocate pattern is a runtime feature from @soda-gql/colocation-tools
// for multi-fragment operations with label prefixing. It requires callback
// builder syntax because:
// 1. It involves multiple fragment spreads in operations (callback-only)
// 2. It uses special fragment metadata for label mapping
// 3. It requires runtime result parsing with createExecutionResultParser
//
// This is an advanced pattern primarily used in component colocation scenarios.

/**
 * Example: $colocate pattern (requires callback builder)
 * This demonstrates the concept - actual usage requires colocation-tools setup
 *
 * @example
 * ```typescript
 * import { gql } from "@/graphql-system";
 *
 * // Component-colocated fragment with $colocate label
 * export const UserCard_fragment = gql.default(({ fragment }) =>
 *   fragment.User({
 *     fields: ({ f }) => ({
 *       ...f.id(),
 *       ...f.name(),
 *     }),
 *     metadata: { $colocate: "UserCard" }, // Label for result parsing
 *   }),
 * );
 *
 * export const UserAvatar_fragment = gql.default(({ fragment }) =>
 *   fragment.User({
 *     fields: ({ f }) => ({
 *       ...f.id(),
 *       ...f.avatarUrl(),
 *     }),
 *     metadata: { $colocate: "UserAvatar" },
 *   }),
 * );
 *
 * // Operation spreading multiple colocated fragments
 * export const getUserQuery = gql.default(({ query, $var }) =>
 *   query.operation({
 *     name: "GetUser",
 *     variables: { ...$var("userId").ID("!") },
 *     fields: ({ f, $ }) => ({
 *       ...f.user({ id: $.userId })(() => ({
 *         ...UserCard_fragment.spread(),
 *         ...UserAvatar_fragment.spread(),
 *       })),
 *     }),
 *   }),
 * );
 *
 * // Result parsing with createExecutionResultParser
 * import { createExecutionResultParser } from "@soda-gql/colocation-tools";
 *
 * const parser = createExecutionResultParser(getUserQuery);
 * const result = await client.query(getUserQuery);
 * const parsed = parser(result);
 * // parsed.UserCard contains UserCard_fragment data
 * // parsed.UserAvatar contains UserAvatar_fragment data
 * ```
 */

/**
 * Summary: Why These Features Require Callback Builder
 *
 * | Feature | Reason Tagged Templates Can't Express It |
 * |---------|-------------------------------------------|
 * | Field Aliases | Requires runtime configuration via field factory's second parameter |
 * | Fragment Spreads (Operations) | Tagged templates reject all interpolation in operations |
 * | Metadata Callbacks | Both support it, but fragmentMetadata parameter more useful with callback spreads |
 * | Document Transforms | Architectural feature (adapter-level), not syntax-specific |
 * | $colocate Pattern | Requires multiple fragment spreads + special metadata (callback-only features) |
 *
 * **Key Architectural Principle:**
 * Tagged templates prioritize static GraphQL string parsing for typegen and tooling.
 * Callback builders enable dynamic runtime configuration for advanced use cases.
 * Both syntaxes produce valid GraphQL documents; the choice depends on feature needs.
 */
