import type { BuilderArtifactElement } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";
import type {
  GqlCallFragment,
  GqlCallOperation,
  PluginAnalysisArtifactMissingError,
  PluginAnalysisMetadataMissingError,
  PluginAnalysisUnsupportedArtifactTypeError,
  PluginError,
} from "@soda-gql/plugin-common";
import { resolveCanonicalId } from "@soda-gql/plugin-common";
import { err, ok, type Result } from "neverthrow";
import type * as ts from "typescript";
import type { GqlDefinitionMetadataMap } from "./metadata";

export type ArtifactLookup = (canonicalId: CanonicalId) => BuilderArtifactElement | undefined;

// TypeScript-specific GqlCall types
export type TsGqlCallFragment = GqlCallFragment & { readonly callNode: ts.CallExpression };
export type TsGqlCallOperation = GqlCallOperation & { readonly callNode: ts.CallExpression };

export type TsGqlCall = TsGqlCallFragment | TsGqlCallOperation;

export type ExtractGqlCallArgs = {
  readonly callNode: ts.CallExpression;
  readonly filename: string;
  readonly metadata: GqlDefinitionMetadataMap;
  readonly getArtifact: ArtifactLookup;
};

export const extractGqlCall = ({
  callNode,
  filename,
  metadata,
  getArtifact,
}: ExtractGqlCallArgs): Result<TsGqlCall, PluginError> => {
  const meta = metadata.get(callNode);
  if (!meta) {
    return err(createMetadataMissingError({ filename }));
  }

  const canonicalId = resolveCanonicalId(filename, meta.astPath);
  const artifact = getArtifact(canonicalId);

  if (!artifact) {
    return err(createArtifactMissingError({ filename, canonicalId }));
  }

  if (artifact.type === "fragment") {
    return ok({ callNode, canonicalId, type: "fragment", artifact });
  }

  if (artifact.type === "operation") {
    return ok({ callNode, canonicalId, type: "operation", artifact });
  }

  return err(
    createUnsupportedArtifactTypeError({
      filename,
      canonicalId,
      artifactType: (artifact as { type: string }).type,
    }),
  );
};

type MetadataErrorInput = { readonly filename: string };
type ArtifactMissingErrorInput = { readonly filename: string; readonly canonicalId: CanonicalId };
type UnsupportedArtifactTypeInput = {
  readonly filename: string;
  readonly canonicalId: CanonicalId;
  readonly artifactType: string;
};

const createMetadataMissingError = ({ filename }: MetadataErrorInput): PluginAnalysisMetadataMissingError => ({
  type: "PluginError",
  stage: "analysis",
  code: "SODA_GQL_METADATA_NOT_FOUND",
  message: `No GraphQL metadata found for ${filename}`,
  cause: { filename },
  filename,
});

const createArtifactMissingError = ({
  filename,
  canonicalId,
}: ArtifactMissingErrorInput): PluginAnalysisArtifactMissingError => ({
  type: "PluginError",
  stage: "analysis",
  code: "SODA_GQL_ANALYSIS_ARTIFACT_NOT_FOUND",
  message: `No builder artifact found for canonical ID ${canonicalId}`,
  cause: { filename, canonicalId },
  filename,
  canonicalId,
});

const createUnsupportedArtifactTypeError = ({
  filename,
  canonicalId,
  artifactType,
}: UnsupportedArtifactTypeInput): PluginAnalysisUnsupportedArtifactTypeError => ({
  type: "PluginError",
  stage: "analysis",
  code: "SODA_GQL_UNSUPPORTED_ARTIFACT_TYPE",
  message: `Unsupported builder artifact type "${artifactType}" for canonical ID ${canonicalId}`,
  cause: { filename, canonicalId, artifactType },
  filename,
  canonicalId,
  artifactType,
});
