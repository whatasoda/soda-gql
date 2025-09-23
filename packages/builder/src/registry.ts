import { isAbsolute, normalize, resolve } from "node:path";
import { err, ok, type Result } from "neverthrow";

export type CanonicalId = string & { readonly __brand: "CanonicalId" };

const canonicalIdSeparator = "::" as const;

const normalisePath = (value: string): string => normalize(value).replace(/\\/g, "/");

export const createCanonicalId = (filePath: string, exportName: string): CanonicalId => {
  if (!isAbsolute(filePath)) {
    throw new Error("CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
  }

  const resolved = resolve(filePath);
  const normalised = normalisePath(resolved);
  return `${normalised}${canonicalIdSeparator}${exportName}` as CanonicalId;
};

export type RegistryRefKind = "model" | "slice" | "operation";

export type ModelRefMetadata = {
  readonly hash: string;
  readonly dependencies: readonly CanonicalId[];
};

export type SliceRefMetadata = {
  readonly canonicalDocument: string;
};

export type OperationRefMetadata = {
  readonly canonicalDocument: string;
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

export type RegistryRefInput<TKind extends RegistryRefKind, TValue> = {
  readonly id: CanonicalId;
  readonly kind: TKind;
  readonly metadata: RegistryRefMetadataMap[TKind];
  readonly loader: RegistryRefLoader<TValue>;
};

export type RegistryRefEntry<TKind extends RegistryRefKind, TValue> = RegistryRefInput<TKind, TValue>;

export type RegisterRefResult<TValue> = Result<RegistryRefEntry<RegistryRefKind, TValue>, RegistryRefError>;

export type RegistryRefError = {
  readonly code: "REF_ALREADY_REGISTERED";
  readonly id: CanonicalId;
};

export type DocumentEntry = {
  readonly name: string;
  readonly text: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly sourcePath?: string;
};

export type RegisterDocumentInput = DocumentEntry;

export type DocumentRegisterError = {
  readonly code: "DOCUMENT_ALREADY_REGISTERED";
  readonly name: string;
};

export type RegisterDocumentResult = Result<DocumentEntry, DocumentRegisterError>;

export type RegistrySnapshot = {
  readonly documents: Readonly<Record<string, DocumentEntry>>;
  readonly refs: Readonly<
    Record<
      CanonicalId,
      {
        readonly kind: RegistryRefKind;
        readonly metadata: RegistryRefMetadataMap[RegistryRefKind];
      }
    >
  >;
};

export type RegistryGetRefError = {
  readonly code: "REF_NOT_FOUND";
  readonly id: CanonicalId;
};

export type DocumentLookupError = {
  readonly code: "DOCUMENT_NOT_FOUND";
  readonly name: string;
};

export type RegistryRefLookupResult<TValue> = Result<RegistryRefEntry<RegistryRefKind, TValue>, RegistryGetRefError>;

export type DocumentRegistry<TValue> = {
  readonly registerRef: <TKind extends RegistryRefKind>(input: RegistryRefInput<TKind, TValue>) => RegisterRefResult<TValue>;
  readonly getRef: (id: CanonicalId) => RegistryRefLookupResult<TValue>;
  readonly registerDocument: (input: RegisterDocumentInput) => RegisterDocumentResult;
  readonly getDocument: (name: string) => Result<DocumentEntry, DocumentLookupError>;
  readonly snapshot: () => RegistrySnapshot;
};

const toSnapshotEntry = (entry: RegistryRefEntry<RegistryRefKind, unknown>) => ({
  kind: entry.kind,
  metadata: entry.metadata,
});

export const createDocumentRegistry = <TValue>(): DocumentRegistry<TValue> => {
  const refs = new Map<CanonicalId, RegistryRefEntry<RegistryRefKind, TValue>>();
  const documents = new Map<string, DocumentEntry>();

  return {
    registerRef: (input) => {
      if (refs.has(input.id)) {
        return err({
          code: "REF_ALREADY_REGISTERED",
          id: input.id,
        } satisfies RegistryRefError);
      }

      refs.set(input.id, input as RegistryRefEntry<RegistryRefKind, TValue>);
      return ok(input as RegistryRefEntry<RegistryRefKind, TValue>);
    },

    getRef: (id) => {
      const entry = refs.get(id);

      if (!entry) {
        return err({
          code: "REF_NOT_FOUND",
          id,
        } satisfies RegistryGetRefError);
      }

      return ok(entry);
    },

    registerDocument: (input) => {
      if (documents.has(input.name)) {
        return err({
          code: "DOCUMENT_ALREADY_REGISTERED",
          name: input.name,
        } satisfies DocumentRegisterError);
      }

      const value = {
        name: input.name,
        text: input.text,
        variables: { ...input.variables },
        sourcePath: input.sourcePath,
      };

      documents.set(input.name, value);

      return ok(value);
    },

    getDocument: (name) => {
      const entry = documents.get(name);

      if (!entry) {
        return err({
          code: "DOCUMENT_NOT_FOUND",
          name,
        } satisfies DocumentLookupError);
      }

      return ok(entry);
    },

    snapshot: () => {
      const documentRecord = Object.fromEntries(documents.entries());
      const refRecord = Object.fromEntries(Array.from(refs.entries(), ([id, entry]) => [id, toSnapshotEntry(entry)])) as Record<
        CanonicalId,
        { kind: RegistryRefKind; metadata: RegistryRefMetadataMap[RegistryRefKind] }
      >;

      return {
        documents: documentRecord,
        refs: refRecord,
      } satisfies RegistrySnapshot;
    },
  } satisfies DocumentRegistry<TValue>;
};
