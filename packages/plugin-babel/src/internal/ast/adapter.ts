/**
 * Babel implementation of the TransformAdapter interface.
 *
 * This adapter wraps the existing Babel-specific transformation logic
 * for soda-gql zero-runtime transformations.
 */

import type { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { TransformAdapter, TransformAdapterFactory, TransformPassResult, TransformProgramContext } from "../types";
import { ensureGqlRuntimeImport, removeGraphqlSystemImports } from "./imports";
import { collectGqlDefinitionMetadata } from "./metadata";
import { transformCallExpression } from "./transformer";

/**
 * Babel-specific environment required for the adapter.
 */
export type BabelEnv = {
  readonly programPath: NodePath<t.Program>;
  readonly types: typeof t;
  readonly graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper;
};

/**
 * Babel implementation of TransformAdapter.
 */
/**
 * Creates a Babel implementation of TransformAdapter using closure pattern.
 */
const createBabelAdapter = (env: BabelEnv, graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper): TransformAdapter => {
  let runtimeCallsFromLastTransform: t.Expression[] = [];

  /**
   * Check if a node is a require() or __webpack_require__() call.
   */
  const isRequireCall = (node: t.Node): boolean => {
    if (!env.types.isCallExpression(node)) {
      return false;
    }

    const callee = node.callee;
    return env.types.isIdentifier(callee) && (callee.name === "require" || callee.name === "__webpack_require__");
  };

  /**
   * Find the last statement that loads a module (import or require).
   * Handles both ESM imports and CommonJS require() calls.
   */
  const findLastModuleLoader = (): NodePath<t.Statement> | null => {
    const bodyPaths = env.programPath.get("body");
    let lastLoader: NodePath<t.Statement> | null = null;

    for (const path of bodyPaths) {
      // ESM: import declaration
      if (path.isImportDeclaration()) {
        lastLoader = path;
        continue;
      }

      // CommonJS: const foo = require("bar") or const foo = __webpack_require__(123)
      if (path.isVariableDeclaration()) {
        for (const declarator of path.node.declarations) {
          if (declarator.init && isRequireCall(declarator.init)) {
            lastLoader = path;
            break;
          }
        }
        continue;
      }

      // CommonJS: require("bar") or __webpack_require__(123) as standalone expression
      if (path.isExpressionStatement()) {
        if (isRequireCall(path.node.expression)) {
          lastLoader = path;
        }
      }
    }

    return lastLoader;
  };

  const transformProgram = (context: TransformProgramContext): TransformPassResult => {
    const metadata = collectGqlDefinitionMetadata({
      programPath: env.programPath,
      filename: context.filename,
    });

    runtimeCallsFromLastTransform = [];
    let transformed = false;

    env.programPath.traverse({
      CallExpression: (callPath) => {
        const result = transformCallExpression({
          callPath,
          filename: context.filename,
          metadata,
          getArtifact: context.artifactLookup,
        });

        if (result.transformed) {
          ensureGqlRuntimeImport(env.programPath);
          transformed = true;

          if (result.runtimeCall) {
            runtimeCallsFromLastTransform.push(result.runtimeCall);
          }
        }
      },
    });

    if (transformed) {
      env.programPath.scope.crawl();
      removeGraphqlSystemImports(env.programPath, graphqlSystemIdentifyHelper, context.filename);
    }

    return {
      transformed,
      runtimeArtifacts: undefined,
    };
  };

  const insertRuntimeSideEffects = (_context: TransformProgramContext, _runtimeIR: ReadonlyArray<unknown>): void => {
    // Use internally tracked runtime calls from transformProgram
    const runtimeCalls = runtimeCallsFromLastTransform;
    if (runtimeCalls.length === 0) {
      return;
    }

    // Wrap expressions in ExpressionStatements before insertion
    const statements = runtimeCalls.map((expr) => env.types.expressionStatement(expr));

    // Find the last import/require statement to insert after all dependencies
    const lastLoaderPath = findLastModuleLoader();

    if (lastLoaderPath) {
      lastLoaderPath.insertAfter(statements);
    } else {
      // Fallback: insert at the beginning if no loaders found
      env.programPath.unshiftContainer("body", statements);
    }

    // Clear to prevent repeated insertions
    runtimeCallsFromLastTransform = [];
  };

  return {
    transformProgram,
    insertRuntimeSideEffects,
  };
}

/**
 * Factory for creating BabelAdapter instances.
 */
export const babelTransformAdapterFactory: TransformAdapterFactory = {
  id: "babel",
  create(env: unknown): TransformAdapter {
    if (!isBabelEnv(env)) {
      throw new Error("[INTERNAL] BabelAdapter requires BabelEnv");
    }
    return createBabelAdapter(env, env.graphqlSystemIdentifyHelper);
  },
};

/**
 * Type guard for BabelEnv.
 */
const isBabelEnv = (env: unknown): env is BabelEnv => {
  return (
    typeof env === "object" && env !== null && "programPath" in env && "types" in env && "graphqlSystemIdentifyHelper" in env
  );
};
