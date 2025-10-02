import { err, ok, type Result } from "neverthrow";
import type { BuilderArtifactModel, BuilderArtifactOperation, BuilderArtifactSlice } from "../types";
import type { CanonicalId } from "../utils/canonical-id";

export type RegistryRefError = {
  readonly code: "MODEL_ALREADY_REGISTERED" | "SLICE_ALREADY_REGISTERED" | "OPERATION_ALREADY_REGISTERED";
  readonly id: CanonicalId;
};

export type RegistrySnapshot = {
  readonly operations: Readonly<Record<CanonicalId, BuilderArtifactOperation>>;
  readonly slices: Readonly<Record<CanonicalId, BuilderArtifactSlice>>;
  readonly models: Readonly<Record<CanonicalId, BuilderArtifactModel>>;
};

export type OperationRegistry = {
  readonly registerModel: (input: BuilderArtifactModel) => Result<BuilderArtifactModel, RegistryRefError>;
  readonly registerSlice: (input: BuilderArtifactSlice) => Result<BuilderArtifactSlice, RegistryRefError>;
  readonly registerOperation: (input: BuilderArtifactOperation) => Result<BuilderArtifactOperation, RegistryRefError>;
  readonly snapshot: () => RegistrySnapshot;
};

export const createOperationRegistry = (): OperationRegistry => {
  const models = new Map<CanonicalId, BuilderArtifactModel>();
  const slices = new Map<CanonicalId, BuilderArtifactSlice>();
  const operations = new Map<CanonicalId, BuilderArtifactOperation>();

  return {
    registerModel: (input) => {
      if (models.has(input.id)) {
        return err({ code: "MODEL_ALREADY_REGISTERED", id: input.id });
      }
      models.set(input.id, input);
      return ok(input);
    },
    registerSlice: (input) => {
      if (slices.has(input.id)) {
        return err({ code: "SLICE_ALREADY_REGISTERED", id: input.id });
      }
      slices.set(input.id, input);
      return ok(input);
    },
    registerOperation: (input) => {
      if (operations.has(input.id)) {
        return err({ code: "OPERATION_ALREADY_REGISTERED", id: input.id });
      }
      operations.set(input.id, input);
      return ok(input);
    },
    snapshot: () => ({
      operations: Object.fromEntries(operations.entries()) as Record<CanonicalId, BuilderArtifactOperation>,
      slices: Object.fromEntries(slices.entries()) as Record<CanonicalId, BuilderArtifactSlice>,
      models: Object.fromEntries(models.entries()) as Record<CanonicalId, BuilderArtifactModel>,
    }),
  };
};
