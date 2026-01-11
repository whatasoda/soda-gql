/**
 * Fixture manifest for formatting tests.
 */

export const validFixtures = [
  "already-formatted",
  "config-arrays",
  "multi-schema",
  "multi-schema-formatted",
  "needs-format",
] as const;

export const invalidFixtures = [
  "no-gql", // Files without gql usage
] as const;

export type ValidFixtureName = (typeof validFixtures)[number];
export type InvalidFixtureName = (typeof invalidFixtures)[number];
