import type { IntermediateArtifactElement } from "@soda-gql/core";

export type IntermediateModuleRaw = {
  register: () => void;
};

export type IntermediateModuleOutput = {
  readonly elements: Record<string, IntermediateArtifactElement>;
};
