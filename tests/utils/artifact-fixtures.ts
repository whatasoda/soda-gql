import type { BuilderArtifact, BuilderArtifactEntry, CanonicalId } from "@soda-gql/builder";

type ArtifactElementTuple = [id: CanonicalId, element: BuilderArtifactEntry];

export const createBuilderArtifact = (
  elements: ArtifactElementTuple[],
  overrides?: {
    durationMs?: number;
    warnings?: readonly string[];
    cache?: { hits?: number; misses?: number };
  },
): BuilderArtifact => {
  const elementsMap: Record<string, BuilderArtifactEntry> = {};
  for (const [id, element] of elements) {
    elementsMap[id] = element;
  }

  return {
    elements: elementsMap as Record<CanonicalId, BuilderArtifactEntry>,
    report: {
      durationMs: overrides?.durationMs ?? 0,
      warnings: overrides?.warnings ?? [],
      cache: {
        hits: overrides?.cache?.hits ?? 0,
        misses: overrides?.cache?.misses ?? 0,
      },
    },
  };
};

export const createInvalidArtifactElement = (data: object): BuilderArtifactEntry => {
  return data as unknown as BuilderArtifactEntry;
};
