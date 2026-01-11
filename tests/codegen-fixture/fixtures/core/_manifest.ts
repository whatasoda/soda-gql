/**
 * Fixture manifest for core tests (analysis + transformation).
 *
 * All valid fixtures are tested by both analyzers (TypeScript and SWC)
 * and transformers (tsc, swc, babel) to ensure consistent behavior.
 */

export const validFixtures = [
  // Anonymous patterns
  "anonymous-destructure",
  "anonymous-function-arg",
  "anonymous-hasura-destructure",
  "anonymous-method-chain-destructure",

  // Core patterns
  "arrow-function",
  "attach-chaining",
  "class-method",
  "deeply-nested",
  "duplicate-names",
  "exported-and-private",
  "exported-function",
  "multiple-same-scope",
  "multiple-schemas",
  "nested-in-function",
  "nested-in-functions",
  "nested-non-top-level",
  "object-property",
  "object-property-exports",
  "sample",
  "top-level-definitions",
  "top-level-simple",
  "top-level-with-metadata",

  // Common helpers
  "common/object-wrapped",
  "common/top-level",

  // Import/export patterns
  "imported-binding-refs",
  "imported-slice-refs",
  "local-and-imported-deps",
  "namespace-imports",
  "nested-namespace-deps",

  // Fragments
  "fragments/basic/source",
  "fragments/multiple-files/product",
  "fragments/multiple-files/user",
  "fragments/spreading/basic-spread",
  "fragments/spreading/fragment-in-fragment",
  "fragments/spreading/multiple-fragments",

  // Imports (transformation tests)
  "imports/add-runtime/source",
  "imports/merge-runtime-import/source",
  "imports/multiple-definitions/source",
  "imports/preserve-other-imports/source",

  // Operations
  "mutation-simple",
  "mutation-with-slice",
  "subscription-simple",
  "subscription-with-variables",
  "operations/basic/source",
  "operations/inline-with-imported-fragments/fragments",
  "operations/inline-with-imported-fragments/operations",

  // Runtime behavior
  "runtime/cross-file-order/operations",
  "runtime/cross-file-order/slices",

  // Scopes
  "scopes/deeply-nested/source",
  "scopes/duplicate-names/source",
] as const;

export const invalidFixtures = [
  "class-properties/source",
  "invalid-call-no-args/source",
  "invalid-call-wrong-type/source",
  "no-gql-code/source",
  "renamed-import/source",
  "star-import/source",
] as const;

export type ValidFixtureName = (typeof validFixtures)[number];
export type InvalidFixtureName = (typeof invalidFixtures)[number];
