import type { IntermediateArtifactElement } from "@soda-gql/core";

export type IntermediateModuleRaw = {
  _?: never;
};

export type IntermediateModuleOutput = {
  readonly elements: Record<string, IntermediateArtifactElement>;
};
