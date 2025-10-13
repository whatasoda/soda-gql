/**
 * Babel implementation of the TransformAdapter interface.
 *
 * This adapter wraps the existing Babel-specific transformation logic
 * and translates between Babel AST and library-neutral IR.
 */

import type { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { resolveCanonicalId } from "../../cache";
import type {
  DefinitionMetadataMap,
  GraphQLCallAnalysis,
  GraphQLCallIR,
  RuntimeCallDescriptor,
  RuntimeExpression,
} from "../../core/ir";
import { makeRuntimeExpression } from "../../core/ir";
import type {
  TransformAdapter,
  TransformAdapterFactory,
  TransformPassResult,
  TransformProgramContext,
} from "../../core/transform-adapter";
import type { PluginError } from "../../state";
import { extractGqlCall, findGqlBuilderCall, type GqlCall } from "./analysis";
import { ensureGqlRuntimeImport, maybeRemoveUnusedGqlImport } from "./imports";
import { collectGqlDefinitionMetadata, type GqlDefinitionMetadataMap } from "./metadata";
import { buildOperationRuntimeComponents } from "./runtime";
import { transformCallExpression } from "./transformer";

/**
 * Babel-specific environment required for the adapter.
 */
export type BabelEnv = {
  readonly programPath: NodePath<t.Program>;
  readonly types: typeof t;
};

/**
 * Babel implementation of TransformAdapter.
 */
export class BabelAdapter implements TransformAdapter {
  private readonly env: BabelEnv;
  private runtimeCallsFromLastTransform: t.Expression[] = [];

  constructor(env: BabelEnv) {
    this.env = env;
  }

  collectDefinitionMetadata(context: TransformProgramContext): DefinitionMetadataMap {
    const babelMetadata: GqlDefinitionMetadataMap = collectGqlDefinitionMetadata({
      programPath: this.env.programPath,
      filename: context.filename,
    });

    // Convert Babel WeakMap to library-neutral Map with canonical IDs as keys
    const neutralMetadata: DefinitionMetadataMap = new Map();
    const _program = this.env.programPath.node;

    this.env.programPath.traverse({
      CallExpression: (callPath) => {
        const meta = babelMetadata.get(callPath.node);
        if (meta) {
          const canonicalId = resolveCanonicalId(context.filename, meta.astPath);
          neutralMetadata.set(canonicalId, {
            astPath: meta.astPath,
            isTopLevel: meta.isTopLevel,
            isExported: meta.isExported,
            exportBinding: meta.exportBinding,
          });
        }
      },
    });

    return neutralMetadata;
  }

  analyzeCall(context: TransformProgramContext, candidate: unknown): GraphQLCallAnalysis | PluginError {
    if (!isCallExpressionPath(candidate)) {
      throw new Error("[INTERNAL] BabelAdapter.analyzeCall expects NodePath<t.CallExpression>");
    }

    const callPath = candidate as NodePath<t.CallExpression>;
    const builderCall = findGqlBuilderCall(callPath);
    if (!builderCall) {
      throw new Error("[INTERNAL] Not a GraphQL builder call");
    }

    const metadata = collectGqlDefinitionMetadata({
      programPath: this.env.programPath,
      filename: context.filename,
    });

    const result = extractGqlCall({
      nodePath: callPath,
      filename: context.filename,
      metadata,
      builderCall,
      getArtifact: context.artifactLookup,
    });

    if (result.isErr()) {
      return result.error;
    }

    const gqlCall = result.value;
    return this.gqlCallToIR(gqlCall, context.filename);
  }

  transformProgram(context: TransformProgramContext): TransformPassResult {
    const metadata = collectGqlDefinitionMetadata({
      programPath: this.env.programPath,
      filename: context.filename,
    });

    this.runtimeCallsFromLastTransform = [];
    let transformed = false;

    this.env.programPath.traverse({
      CallExpression: (callPath) => {
        const result = transformCallExpression({
          callPath,
          filename: context.filename,
          metadata,
          getArtifact: context.artifactLookup,
        });

        if (result.transformed) {
          ensureGqlRuntimeImport(this.env.programPath);
          transformed = true;

          if (result.runtimeCall) {
            this.runtimeCallsFromLastTransform.push(result.runtimeCall);
          }
        }
      },
    });

    if (transformed) {
      this.env.programPath.scope.crawl();
      maybeRemoveUnusedGqlImport(this.env.programPath);
    }

    return {
      transformed,
      runtimeArtifacts: undefined,
    };
  }

  insertRuntimeSideEffects(_context: TransformProgramContext, _runtimeIR: ReadonlyArray<GraphQLCallIR>): void {
    // Use internally tracked runtime calls from transformProgram
    const runtimeCalls = this.runtimeCallsFromLastTransform;
    if (runtimeCalls.length === 0) {
      return;
    }

    // Insert after @soda-gql/runtime import
    this.env.programPath.traverse({
      ImportDeclaration(importDeclPath) {
        if (importDeclPath.node.source.value === "@soda-gql/runtime") {
          importDeclPath.insertAfter(runtimeCalls);
        }
      },
    });
  }

  /**
   * Convert Babel GqlCall to library-neutral IR.
   */
  private gqlCallToIR(gqlCall: GqlCall, filename: string): GraphQLCallAnalysis {
    const descriptor = this.createRuntimeDescriptor(gqlCall);
    const ir: GraphQLCallIR = {
      descriptor,
      sourceFile: filename,
    };

    // For operations, we also need to insert a runtime call
    let runtimeInsertion: RuntimeExpression | undefined;
    if (gqlCall.type === "operation") {
      const { runtimeCall } = buildOperationRuntimeComponents(gqlCall);
      runtimeInsertion = makeRuntimeExpression(runtimeCall);
    }

    return { ir, runtimeInsertion };
  }

  /**
   * Create a RuntimeCallDescriptor from a Babel GqlCall.
   */
  private createRuntimeDescriptor(gqlCall: GqlCall): RuntimeCallDescriptor {
    if (gqlCall.type === "model") {
      const [, , normalize] = gqlCall.builderCall.arguments;
      return {
        type: "model",
        canonicalId: gqlCall.canonicalId,
        typename: gqlCall.artifact.prebuild.typename,
        normalize: makeRuntimeExpression(normalize),
      };
    }

    if (gqlCall.type === "slice") {
      const [, , projectionBuilder] = gqlCall.builderCall.arguments;
      return {
        type: "slice",
        canonicalId: gqlCall.canonicalId,
        operationType: gqlCall.artifact.prebuild.operationType,
        buildProjection: makeRuntimeExpression(projectionBuilder),
      };
    }

    if (gqlCall.type === "operation") {
      const [, slicesBuilder] = gqlCall.builderCall.arguments;
      return {
        type: "operation",
        canonicalId: gqlCall.canonicalId,
        operationName: gqlCall.artifact.prebuild.operationName,
        prebuildPayload: gqlCall.artifact.prebuild,
        getSlices: makeRuntimeExpression(slicesBuilder),
      };
    }

    throw new Error("[INTERNAL] Unknown GqlCall type");
  }
}

/**
 * Type guard for Babel CallExpression path.
 */
const isCallExpressionPath = (candidate: unknown): candidate is NodePath<t.CallExpression> => {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "node" in candidate &&
    typeof (candidate as { node: unknown }).node === "object" &&
    (candidate as { node: { type?: string } }).node.type === "CallExpression"
  );
};

/**
 * Factory for creating BabelAdapter instances.
 */
export const babelTransformAdapterFactory: TransformAdapterFactory = {
  id: "babel",
  create(env: unknown): BabelAdapter {
    if (!isBabelEnv(env)) {
      throw new Error("[INTERNAL] BabelAdapter requires BabelEnv");
    }
    return new BabelAdapter(env);
  },
};

/**
 * Type guard for BabelEnv.
 */
const isBabelEnv = (env: unknown): env is BabelEnv => {
  return typeof env === "object" && env !== null && "programPath" in env && "types" in env;
};
