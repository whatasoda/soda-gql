import type { BuilderArtifactElement, BuilderArtifactElementMetadata } from "@soda-gql/builder";

const createMockMetadata = (): BuilderArtifactElementMetadata => ({
  sourcePath: "/mock/path.ts",
  sourceHash: "mock-hash",
  contentHash: "mock-content-hash",
});

export const createMockArtifactElement = (
  partial: Omit<BuilderArtifactElement, "metadata"> & { metadata?: Partial<BuilderArtifactElementMetadata> },
): BuilderArtifactElement => {
  const metadata = { ...createMockMetadata(), ...partial.metadata };
  return { ...partial, metadata } as BuilderArtifactElement;
};
