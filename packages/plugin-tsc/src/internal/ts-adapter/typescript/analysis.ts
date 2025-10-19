import type {
  BuilderArtifactElement,
  BuilderArtifactModel,
  BuilderArtifactOperation,
  BuilderArtifactSlice,
  CanonicalId,
} from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";
import type * as ts from "typescript";
import { resolveCanonicalId } from "../../canonical-id.js";
import type {
  PluginAnalysisArtifactMissingError,
  PluginAnalysisMetadataMissingError,
  PluginAnalysisUnsupportedArtifactTypeError,
  PluginError,
} from "../../errors.js";
import type { GqlDefinitionMetadataMap } from "./metadata.js";

export type ArtifactLookup = (canonicalId: CanonicalId) => BuilderArtifactElement | undefined;

export type GqlCallBase = {
  readonly callNode: ts.CallExpression;
  readonly canonicalId: CanonicalId;
  readonly builderCall: ts.CallExpression;
};

export type GqlCallModel = GqlCallBase & { readonly type: "model"; readonly artifact: BuilderArtifactModel };
export type GqlCallSlice = GqlCallBase & { readonly type: "slice"; readonly artifact: BuilderArtifactSlice };
export type GqlCallOperation = GqlCallBase & { readonly type: "operation"; readonly artifact: BuilderArtifactOperation };

export type GqlCall = GqlCallModel | GqlCallSlice | GqlCallOperation;

export type ExtractGqlCallArgs = {
  readonly callNode: ts.CallExpression;
  readonly filename: string;
  readonly metadata: GqlDefinitionMetadataMap;
  readonly builderCall: ts.CallExpression;
  readonly getArtifact: ArtifactLookup;
};

export const extractGqlCall = ({
  callNode,
  filename,
  metadata,
  builderCall,
  getArtifact,
}: ExtractGqlCallArgs): Result<GqlCall, PluginError> => {
  const meta = metadata.get(callNode);
  if (!meta) {
    return err(createMetadataMissingError({ filename }));
  }

  const canonicalId = resolveCanonicalId(filename, meta.astPath);
  const artifact = getArtifact(canonicalId);

  if (!artifact) {
    return err(createArtifactMissingError({ filename, canonicalId }));
  }

  const base: GqlCallBase = { callNode, canonicalId, builderCall };

  if (artifact.type === "model") {
    return ok({ ...base, type: "model", artifact });
  }

  if (artifact.type === "slice") {
    return ok({ ...base, type: "slice", artifact });
  }

  if (artifact.type === "operation") {
    return ok({ ...base, type: "operation", artifact });
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

export const findGqlBuilderCall = (callNode: ts.CallExpression, typescript: typeof ts): ts.CallExpression | null =>
  resolveBuilderCall(callNode, typescript);

const resolveBuilderCall = (call: ts.CallExpression, typescript: typeof ts): ts.CallExpression | null => {
  if (!isGqlMemberExpression(call.expression, typescript)) {
    return null;
  }

  if (call.arguments.length !== 1) {
    return null;
  }

  const factoryArg = call.arguments[0];
  if (!typescript.isArrowFunction(factoryArg)) {
    return null;
  }

  return extractBuilderCall(factoryArg, typescript);
};

const isGqlMemberExpression = (callee: ts.Expression, typescript: typeof ts): callee is ts.PropertyAccessExpression => {
  return typescript.isPropertyAccessExpression(callee) && isGqlReference(callee.expression, typescript);
};

const isGqlReference = (expr: ts.Expression, typescript: typeof ts): boolean => {
  if (typescript.isIdentifier(expr) && expr.text === "gql") {
    return true;
  }
  if (!typescript.isPropertyAccessExpression(expr)) {
    return false;
  }
  if (typescript.isIdentifier(expr.name) && expr.name.text === "gql") {
    return true;
  }
  return isGqlReference(expr.expression, typescript);
};

const extractBuilderCall = (factory: ts.ArrowFunction, typescript: typeof ts): ts.CallExpression | null => {
  const body = factory.body;

  if (typescript.isCallExpression(body)) {
    return body;
  }

  if (!typescript.isBlock(body)) {
    return null;
  }

  for (const statement of body.statements) {
    if (
      typescript.isReturnStatement(statement) &&
      statement.expression !== undefined &&
      typescript.isCallExpression(statement.expression)
    ) {
      return statement.expression;
    }
  }

  return null;
};
