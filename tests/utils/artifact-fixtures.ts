import type { BuilderArtifact, BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";
import { createMockArtifactElement } from "../helpers/artifact";

type ArtifactElementTuple = [id: CanonicalId, element: Omit<BuilderArtifactElement, "metadata">];

export const createBuilderArtifact = (
  elements: ArtifactElementTuple[],
  overrides?: {
    durationMs?: number;
    warnings?: readonly string[];
    cache?: { hits?: number; misses?: number; skips?: number };
    chunks?: { written?: number; skipped?: number };
  },
): BuilderArtifact => {
  const elementsMap: Record<string, BuilderArtifactElement> = {};
  for (const [id, element] of elements) {
    elementsMap[id] = createMockArtifactElement(element);
  }

  return {
    elements: elementsMap as Record<CanonicalId, BuilderArtifactElement>,
    report: {
      durationMs: overrides?.durationMs ?? 0,
      warnings: overrides?.warnings ?? [],
      stats: {
        hits: overrides?.cache?.hits ?? 0,
        misses: overrides?.cache?.misses ?? 0,
        skips: overrides?.cache?.skips ?? 0,
      },
    },
  };
};

export const createInvalidArtifactElement = (data: object): BuilderArtifactElement => {
  return data as unknown as BuilderArtifactElement;
};
