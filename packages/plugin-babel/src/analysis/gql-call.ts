import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type {
  BuilderArtifactEntry,
  BuilderArtifactModel,
  BuilderArtifactOperation,
  BuilderArtifactSlice,
  CanonicalId,
} from "@soda-gql/builder";
import { err, ok, type Result } from "neverthrow";

import { resolveCanonicalId as defaultResolveCanonicalId } from "../artifact";
import type { GqlDefinitionMetadataMap } from "../metadata/collector";
import type {
  PluginAnalysisArtifactMissingError,
  PluginAnalysisMetadataMissingError,
  PluginAnalysisUnsupportedArtifactTypeError,
  PluginError,
} from "../state";

export type ArtifactLookup = (canonicalId: CanonicalId) => BuilderArtifactEntry | undefined;

type ExtractGqlCallDeps = {
  readonly resolveCanonicalId: typeof defaultResolveCanonicalId;
};

const defaultDeps: ExtractGqlCallDeps = {
  resolveCanonicalId: defaultResolveCanonicalId,
};

export type GqlCallBase = {
  readonly nodePath: NodePath<t.CallExpression>;
  readonly canonicalId: CanonicalId;
  readonly builderCall: t.CallExpression;
};

export type GqlCallModel = GqlCallBase & { readonly type: "model"; readonly artifact: BuilderArtifactModel };
export type GqlCallSlice = GqlCallBase & { readonly type: "slice"; readonly artifact: BuilderArtifactSlice };
export type GqlCallOperation = GqlCallBase & { readonly type: "operation"; readonly artifact: BuilderArtifactOperation };

export type GqlCall = GqlCallModel | GqlCallSlice | GqlCallOperation;

export type ExtractGqlCallArgs = {
  readonly nodePath: NodePath<t.CallExpression>;
  readonly filename: string;
  readonly metadata: GqlDefinitionMetadataMap;
  readonly builderCall: t.CallExpression;
  readonly getArtifact: ArtifactLookup;
  readonly deps?: Partial<ExtractGqlCallDeps>;
};

export const extractGqlCall = ({
  nodePath,
  filename,
  metadata,
  builderCall,
  getArtifact,
  deps,
}: ExtractGqlCallArgs): Result<GqlCall, PluginError> => {
  const extractDeps = { ...defaultDeps, ...deps };
  const callExpression = nodePath.node;

  const meta = metadata.get(callExpression);
  if (!meta) {
    return err(createMetadataMissingError({ filename }));
  }

  const canonicalId = extractDeps.resolveCanonicalId(filename, meta.astPath);
  const artifact = getArtifact(canonicalId);

  if (!artifact) {
    return err(createArtifactMissingError({ filename, canonicalId }));
  }

  const base: GqlCallBase = { nodePath, canonicalId, builderCall };

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

const isGqlMemberExpression = (callee: t.Expression | t.V8IntrinsicIdentifier): callee is t.MemberExpression =>
  t.isMemberExpression(callee) &&
  t.isIdentifier(callee.object, { name: "gql" }) &&
  t.isIdentifier(callee.property) &&
  !callee.computed;

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
