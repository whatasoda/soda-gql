import { isAbsolute, normalize, resolve } from "node:path";
import type { ExecutionResultProjectionPathGraphNode } from "@soda-gql/core";
import type { DocumentNode } from "graphql";
import { err, ok, type Result } from "neverthrow";
import type { BuilderArtifactModel, BuilderArtifactOperation, BuilderArtifactSlice } from "./types";

export type CanonicalId = string & { readonly __brand: "CanonicalId" };

const canonicalIdSeparator = "::" as const;

const normalizePath = (value: string): string => normalize(value).replace(/\\/g, "/");

export const createCanonicalId = (filePath: string, exportName: string, schemaName?: string): CanonicalId => {
  if (!isAbsolute(filePath)) {
    throw new Error("CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
  }

  const resolved = resolve(filePath);
  const normalized = normalizePath(resolved);

  // Schema name is now ignored in canonical ID - only used for type generation
  // Always create a 2-part ID: {absPath}::{exportName}
  const idParts = [normalized, exportName];

  return idParts.join(canonicalIdSeparator) as CanonicalId;
};

export type RegistryRefKind = "model" | "slice" | "operation";

export type ModelRefMetadata = {
  readonly hash: string;
  readonly dependencies: readonly CanonicalId[];
};

export type SliceRefMetadata = {
  readonly dependencies: readonly CanonicalId[];
  readonly canonicalDocuments: readonly string[];
};

export type OperationRefMetadata = {
  readonly documentName: string;
  readonly dependencies: readonly CanonicalId[];
};

export type RegistryRefMetadataMap = {
  readonly model: ModelRefMetadata;
  readonly slice: SliceRefMetadata;
  readonly operation: OperationRefMetadata;
};

export type RegistryRefLoader<TValue> = () => Result<TValue, RegistryRefLoadError>;

export type RegistryRefLoadError = {
  readonly code: "REF_EVALUATION_FAILED";
  readonly id: CanonicalId;
  readonly error: unknown;
};

export type RegistryRefInput<TKind extends RegistryRefKind> = {
  readonly id: CanonicalId;
  readonly kind: TKind;
  readonly metadata: RegistryRefMetadataMap[TKind];
};

export type RegistryRefEntry<TKind extends RegistryRefKind> = RegistryRefInput<TKind>;

export type RegisterRefResult = Result<RegistryRefEntry<RegistryRefKind>, RegistryRefError>;

export type RegistryRefError = {
  readonly code:
    | "REF_ALREADY_REGISTERED"
    | "MODEL_ALREADY_REGISTERED"
    | "SLICE_ALREADY_REGISTERED"
    | "OPERATION_ALREADY_REGISTERED";
  readonly id: CanonicalId;
};

export type OperationEntry = {
  readonly name: string;
  readonly text: string;
  readonly variableNames: string[];
  readonly projectionPathGraph: ExecutionResultProjectionPathGraphNode;
  readonly sourcePath?: string;
  readonly ast: DocumentNode;
};

export type RegisterDocumentInput = OperationEntry;

export type DocumentRegisterError = {
  readonly code: "DOCUMENT_ALREADY_REGISTERED";
  readonly name: string;
};

export type RegisterDocumentResult = Result<OperationEntry, DocumentRegisterError>;

export type RegistrySnapshot = {
  readonly operations: Readonly<Record<CanonicalId, BuilderArtifactOperation>>;
  readonly slices: Readonly<Record<CanonicalId, BuilderArtifactSlice>>;
  readonly models: Readonly<Record<CanonicalId, BuilderArtifactModel>>;
};

export type RegistryGetRefError = {
  readonly code: "REF_NOT_FOUND";
  readonly id: CanonicalId;
};

export type DocumentLookupError = {
  readonly code: "DOCUMENT_NOT_FOUND";
  readonly name: string;
};

export type RegistryRefLookupResult = Result<RegistryRefEntry<RegistryRefKind>, RegistryGetRefError>;

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
        return err({
          code: "MODEL_ALREADY_REGISTERED",
          id: input.id,
        } satisfies RegistryRefError);
      }
      models.set(input.id, input);
      return ok(input);
    },
    registerSlice: (input) => {
      if (slices.has(input.id)) {
        return err({
          code: "SLICE_ALREADY_REGISTERED",
          id: input.id,
        } satisfies RegistryRefError);
      }
      slices.set(input.id, input);
      return ok(input);
    },
    registerOperation: (input) => {
      if (operations.has(input.id)) {
        return err({
          code: "OPERATION_ALREADY_REGISTERED",
          id: input.id,
        } satisfies RegistryRefError);
      }
      operations.set(input.id, input);
      return ok(input);
    },

    snapshot: () => {
      return {
        operations: Object.fromEntries(operations.entries()) as Record<CanonicalId, BuilderArtifactOperation>,
        slices: Object.fromEntries(slices.entries()) as Record<CanonicalId, BuilderArtifactSlice>,
        models: Object.fromEntries(models.entries()) as Record<CanonicalId, BuilderArtifactModel>,
      } satisfies RegistrySnapshot;
    },
  } satisfies OperationRegistry;
};
