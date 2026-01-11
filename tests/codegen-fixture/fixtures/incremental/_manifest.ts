/**
 * Fixture manifest for incremental build tests.
 */

export const baseFixtures = [
  "nested-definitions",
  "nested-test-page",
  "profile-page",
  "profile-query",
  "user",
  "user-catalog",
] as const;

export const variants = ["catalog.new", "nested-definitions.updated"] as const;

export type BaseFixtureName = (typeof baseFixtures)[number];
export type VariantName = (typeof variants)[number];
