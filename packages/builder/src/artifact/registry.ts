import { err, ok, type Result } from "neverthrow";
import type { CanonicalId } from "../canonical-id/canonical-id";
import type { BuilderArtifactEntry, BuilderArtifactModel, BuilderArtifactOperation, BuilderArtifactSlice } from "./types";

export type RegistryRefError = {
  readonly code: "ARTIFACT_ALREADY_REGISTERED";
  readonly id: CanonicalId;
};

export type RegistrySnapshot = {
  readonly artifacts: Readonly<Record<CanonicalId, BuilderArtifactEntry>>;
  readonly counts: {
    readonly models: number;
    readonly slices: number;
    readonly operations: number;
  };
};

export type OperationRegistry = {
  readonly registerModel: (input: BuilderArtifactModel) => Result<BuilderArtifactModel, RegistryRefError>;
  readonly registerSlice: (input: BuilderArtifactSlice) => Result<BuilderArtifactSlice, RegistryRefError>;
  readonly registerOperation: (input: BuilderArtifactOperation) => Result<BuilderArtifactOperation, RegistryRefError>;
  readonly snapshot: () => RegistrySnapshot;
};

export const createOperationRegistry = (): OperationRegistry => {
  const artifacts = new Map<CanonicalId, BuilderArtifactEntry>();
  const counts = { models: 0, slices: 0, operations: 0 };

  return {
    registerModel: (input) => {
      if (artifacts.has(input.id)) {
        return err({ code: "ARTIFACT_ALREADY_REGISTERED", id: input.id });
      }
      artifacts.set(input.id, input);
      counts.models++;
      return ok(input);
    },
    registerSlice: (input) => {
      if (artifacts.has(input.id)) {
        return err({ code: "ARTIFACT_ALREADY_REGISTERED", id: input.id });
      }
      artifacts.set(input.id, input);
      counts.slices++;
      return ok(input);
    },
    registerOperation: (input) => {
      if (artifacts.has(input.id)) {
        return err({ code: "ARTIFACT_ALREADY_REGISTERED", id: input.id });
      }
      artifacts.set(input.id, input);
      counts.operations++;
      return ok(input);
    },
    snapshot: () => ({
      artifacts: Object.fromEntries(artifacts.entries()) as Record<CanonicalId, BuilderArtifactEntry>,
      counts: { ...counts },
    }),
  };
};
