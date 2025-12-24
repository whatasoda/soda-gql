import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { BuilderArtifactElement, CanonicalId } from "@soda-gql/builder";
import type {
  GqlCallInlineOperation,
  GqlCallModel,
  PluginAnalysisArtifactMissingError,
  PluginAnalysisMetadataMissingError,
  PluginAnalysisUnsupportedArtifactTypeError,
  PluginError,
} from "@soda-gql/plugin-common";
import { resolveCanonicalId } from "@soda-gql/plugin-common";
import { err, ok, type Result } from "neverthrow";
import type { GqlDefinitionMetadataMap } from "./metadata";

export type ArtifactLookup = (canonicalId: CanonicalId) => BuilderArtifactElement | undefined;

// Babel-specific GqlCall types
export type BabelGqlCallModel = GqlCallModel<t.CallExpression> & { readonly nodePath: NodePath<t.CallExpression> };
export type BabelGqlCallInlineOperation = GqlCallInlineOperation<t.CallExpression> & {
  readonly nodePath: NodePath<t.CallExpression>;
};

export type BabelGqlCall = BabelGqlCallModel | BabelGqlCallInlineOperation;

export type ExtractGqlCallArgs = {
  readonly nodePath: NodePath<t.CallExpression>;
  readonly filename: string;
  readonly metadata: GqlDefinitionMetadataMap;
  readonly builderCall: t.CallExpression;
  readonly getArtifact: ArtifactLookup;
};

export const extractGqlCall = ({
  nodePath,
  filename,
  metadata,
  builderCall,
  getArtifact,
}: ExtractGqlCallArgs): Result<BabelGqlCall, PluginError> => {
  const callExpression = nodePath.node;

  const meta = metadata.get(callExpression);
  if (!meta) {
    return err(createMetadataMissingError({ filename }));
  }

  const canonicalId = resolveCanonicalId(filename, meta.astPath);
  const artifact = getArtifact(canonicalId);

  if (!artifact) {
    return err(createArtifactMissingError({ filename, canonicalId }));
  }

  if (artifact.type === "model") {
    return ok({ nodePath, canonicalId, builderCall, type: "model", artifact });
  }

  if (artifact.type === "inlineOperation") {
    return ok({ nodePath, canonicalId, builderCall, type: "inlineOperation", artifact });
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

export const findGqlBuilderCall = (callPath: NodePath<t.CallExpression>): t.CallExpression | null =>
  resolveBuilderCall(callPath.node);

const resolveBuilderCall = (call: t.CallExpression): t.CallExpression | null => {
  if (!isGqlMemberExpression(call.callee)) {
    return null;
  }

  if (call.arguments.length !== 1) {
    return null;
  }

  const factoryArg = call.arguments[0];
  if (!t.isArrowFunctionExpression(factoryArg)) {
    return null;
  }

  return extractBuilderCall(factoryArg);
};

const isGqlMemberExpression = (callee: t.Expression | t.V8IntrinsicIdentifier): callee is t.MemberExpression => {
  return t.isMemberExpression(callee) && isSimpleProperty(callee.property) && isGqlReference(callee.object);
};

const isSimpleProperty = (property: t.Expression | t.PrivateName): property is t.Identifier | t.StringLiteral =>
  t.isIdentifier(property) || (t.isStringLiteral(property) && property.value.length > 0);

const isGqlReference = (expr: t.Expression | t.Super): boolean => {
  if (t.isIdentifier(expr, { name: "gql" })) {
    return true;
  }
  if (!t.isMemberExpression(expr) || expr.computed) {
    return false;
  }
  if (
    (t.isIdentifier(expr.property) && expr.property.name === "gql") ||
    (t.isStringLiteral(expr.property) && expr.property.value === "gql")
  ) {
    return true;
  }
  return isGqlReference(expr.object);
};

const extractBuilderCall = (factory: t.ArrowFunctionExpression): t.CallExpression | null => {
  if (t.isCallExpression(factory.body)) {
    return factory.body;
  }

  if (!t.isBlockStatement(factory.body)) {
    return null;
  }

  for (const statement of factory.body.body) {
    if (t.isReturnStatement(statement) && statement.argument && t.isCallExpression(statement.argument)) {
      return statement.argument;
    }
  }

  return null;
};
