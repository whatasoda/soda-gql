/**
 * Fixture manifest for module analysis tests.
 *
 * Each fixture is tested by both TypeScript and SWC analyzers.
 * Fixtures with `skipSwc: true` are skipped when running SWC analyzer tests
 * (planned for future SWC implementation).
 */

export interface FixtureEntry {
  readonly name: string;
  readonly skipSwc: boolean;
}

export const fixtures = [
  // From shared/ - both analyzers produce consistent results
  { name: "arrow-function", skipSwc: false },
  { name: "class-method", skipSwc: false },
  { name: "deeply-nested", skipSwc: false },
  { name: "duplicate-names", skipSwc: false },
  { name: "exported-and-private", skipSwc: false },
  { name: "exported-function", skipSwc: false },
  { name: "multiple-same-scope", skipSwc: false },
  { name: "nested-in-function", skipSwc: false },
  { name: "object-property", skipSwc: false },
  { name: "top-level-simple", skipSwc: false },

  // Consolidated from ts/ and swc/ (identical tests)
  { name: "mutation-simple", skipSwc: false },
  { name: "mutation-with-slice", skipSwc: false },
  { name: "subscription-simple", skipSwc: false },
  { name: "subscription-with-variables", skipSwc: false },

  // From swc/ - SWC-specific patterns
  { name: "imported-binding-refs", skipSwc: false },
  { name: "namespace-imports", skipSwc: false },
  { name: "nested-in-functions", skipSwc: false },
  { name: "object-property-exports", skipSwc: false },
  { name: "top-level-definitions", skipSwc: false },

  // From ts/ - TS-specific features (skip SWC for now)
  { name: "imported-slice-refs", skipSwc: true },
  { name: "local-and-imported-deps", skipSwc: true },
  { name: "multiple-schemas", skipSwc: true },
  { name: "nested-namespace-deps", skipSwc: true },
  { name: "nested-non-top-level", skipSwc: true },
  { name: "top-level-with-metadata", skipSwc: true },

  // Model embedding fixtures (TS-only for now)
  { name: "model-embedding/basic-embed", skipSwc: true },
  { name: "model-embedding/model-in-model", skipSwc: true },
  { name: "model-embedding/multiple-models", skipSwc: true },
] as const satisfies readonly FixtureEntry[];

export type FixtureName = (typeof fixtures)[number]["name"];

/**
 * Get fixtures that should run for a given analyzer.
 */
export const getFixturesForAnalyzer = (analyzer: "ts" | "swc"): readonly FixtureEntry[] => {
  if (analyzer === "ts") {
    return fixtures;
  }
  return fixtures.filter((f) => !f.skipSwc);
};

/**
 * Get fixtures that are skipped for SWC analyzer.
 */
export const getSkippedFixturesForSwc = (): readonly FixtureEntry[] => {
  return fixtures.filter((f) => f.skipSwc);
};
