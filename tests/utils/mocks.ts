/**
 * Test mock utilities for coordinator-based plugin architecture
 */

import type { BuilderArtifact, BuilderServiceConfig } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import type { NormalizedOptions } from "@soda-gql/plugin-shared";
import type { CoordinatorKey, CoordinatorSnapshot } from "@soda-gql/plugin-shared/coordinator";

/**
 * Create a mock coordinator key for testing
 * @param name Optional name prefix (default: "test-coordinator")
 * @returns A mock CoordinatorKey
 */
export const makeCoordinatorKey = (name = "test-coordinator"): CoordinatorKey => {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` as CoordinatorKey;
};

/**
 * Create a mock BuilderArtifact for testing
 * @param overrides Partial artifact properties to override defaults
 * @returns A mock BuilderArtifact
 */
export const makeMockArtifact = (overrides: Partial<BuilderArtifact> = {}): BuilderArtifact => {
  return {
    elements: overrides.elements ?? ({} as Record<CanonicalId, any>),
    report: overrides.report ?? {
      durationMs: 0,
      warnings: [],
      stats: {
        hits: 0,
        misses: 0,
        skips: 0,
      },
    },
    ...overrides,
  };
};

/**
 * Create mock resolved config for testing
 * @param overrides Partial config to override defaults
 * @returns A mock ResolvedSodaGqlConfig
 */
export const makeMockResolvedConfig = (overrides: Partial<ResolvedSodaGqlConfig> = {}): ResolvedSodaGqlConfig => {
  return {
    graphqlSystemPath: overrides.graphqlSystemPath ?? "/mock/graphql-system.ts",
    builder: overrides.builder ?? {
      entry: ["src/**/*.ts"],
      outDir: ".cache/soda-gql",
      analyzer: "ts" as const,
    },
    ...overrides,
  } as ResolvedSodaGqlConfig;
};

/**
 * Create mock builder service config for testing
 * @param overrides Partial config to override defaults
 * @returns A mock BuilderServiceConfig
 */
export const makeMockBuilderConfig = (overrides: Partial<BuilderServiceConfig> = {}): BuilderServiceConfig => {
  return {
    config: overrides.config ?? makeMockResolvedConfig(),
    entrypoints: overrides.entrypoints ?? ["src/**/*.ts"],
    ...overrides,
  };
};

/**
 * Create mock normalized options for testing (without deprecated mode/artifact fields)
 * @param overrides Partial options to override defaults
 * @returns A mock NormalizedOptions
 */
export const makeNormalizedOptions = (overrides: Partial<NormalizedOptions> = {}): NormalizedOptions => {
  return {
    importIdentifier: overrides.importIdentifier ?? "@/graphql-system",
    diagnostics: overrides.diagnostics ?? "json",
    resolvedConfig: overrides.resolvedConfig ?? makeMockResolvedConfig(),
    builderConfig: overrides.builderConfig ?? makeMockBuilderConfig(),
    project: overrides.project,
    ...overrides,
  };
};

/**
 * Create a mock coordinator snapshot for testing
 * @param overrides Partial snapshot properties to override defaults
 * @returns A mock CoordinatorSnapshot
 */
export const makeCoordinatorSnapshot = (overrides: Partial<CoordinatorSnapshot> = {}): CoordinatorSnapshot => {
  const defaultArtifact = makeMockArtifact();

  return {
    artifact: overrides.artifact ?? defaultArtifact,
    elements: overrides.elements ?? ({} as Record<CanonicalId, any>),
    generation: overrides.generation ?? 0,
    createdAt: overrides.createdAt ?? Date.now(),
    options: overrides.options ?? makeNormalizedOptions(),
    ...overrides,
  };
};
