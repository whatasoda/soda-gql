/**
 * Fixture manifest for module analysis tests.
 *
 * All fixtures are tested by both TypeScript and SWC analyzers
 * to ensure consistent behavior across implementations.
 */

export const fixtures = [
  // Core patterns - both analyzers produce consistent results
  "arrow-function",
  "class-method",
  "deeply-nested",
  "duplicate-names",
  "exported-and-private",
  "exported-function",
  "multiple-same-scope",
  "nested-in-function",
  "object-property",
  "top-level-simple",

  // Operation types
  "mutation-simple",
  "mutation-with-slice",
  "subscription-simple",
  "subscription-with-variables",

  // Import/export patterns
  "imported-binding-refs",
  "imported-slice-refs",
  "local-and-imported-deps",
  "namespace-imports",
  "nested-namespace-deps",
  "object-property-exports",
  "top-level-definitions",

  // Advanced patterns
  "multiple-schemas",
  "nested-in-functions",
  "nested-non-top-level",
  "top-level-with-metadata",

  // Method chaining patterns
  "attach-chaining",

  // Anonymous/inline patterns
  "anonymous-function-arg",
  "anonymous-destructure",
  "anonymous-method-chain-destructure",
  "anonymous-hasura-destructure",

  // Fragment spreading
  "fragment-spreading/basic-spread",
  "fragment-spreading/fragment-in-fragment",
  "fragment-spreading/multiple-fragments",
] as const;

export type FixtureName = (typeof fixtures)[number];
