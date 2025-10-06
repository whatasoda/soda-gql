import { createHash } from "node:crypto";

import type { BuilderArtifact } from "@soda-gql/builder";

export type ArtifactManifest = {
  readonly digest: string;
  readonly elementCount: number;
  readonly generatedAt: number;
};

const hashArtifactElements = (artifact: BuilderArtifact): string => {
  const sortedEntries = Object.entries(artifact.elements).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const hash = createHash("sha256");
  for (const [key, value] of sortedEntries) {
    hash.update(key);
    hash.update(JSON.stringify(value));
  }
  return hash.digest("hex");
};

export const createArtifactManifest = (artifact: BuilderArtifact): ArtifactManifest => ({
  digest: hashArtifactElements(artifact),
  elementCount: Object.keys(artifact.elements).length,
  generatedAt: Date.now(),
});

export const manifestChanged = (previous: ArtifactManifest | null, next: ArtifactManifest): boolean => {
  if (!previous) {
    return true;
  }
  return previous.digest !== next.digest;
};
