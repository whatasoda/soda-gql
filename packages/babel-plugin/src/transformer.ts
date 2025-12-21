/**
 * Babel implementation of the TransformAdapter interface.
 *
 * This adapter wraps the existing Babel-specific transformation logic
 * for soda-gql zero-runtime transformations.
 */

import type { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { formatPluginError } from "@soda-gql/plugin-common";
import { ensureGqlRuntimeImport, removeGraphqlSystemImports } from "./ast/imports";
import { collectGqlDefinitionMetadata } from "./ast/metadata";
import { transformCallExpression } from "./ast/transformer";
import type { TransformPassResult, TransformProgramContext } from "./types";

/**
 * Creates a Babel transformer with a single transform() method.
 * This matches the pattern used in the TypeScript plugin.
 */
export const createTransformer = ({
  programPath,
  types,
  config,
}: {
  readonly programPath: NodePath<t.Program>;
  readonly types: typeof t;
  readonly config: ResolvedSodaGqlConfig;
}) => {
  // Create graphql system identify helper using builder's implementation
  const graphqlSystemIdentifyHelper = createGraphqlSystemIdentifyHelper(config);

  /**
   * Check if a node is a require() or __webpack_require__() call.
   */
  const isRequireCall = (node: t.Node): boolean => {
    if (!types.isCallExpression(node)) {
      return false;
    }

    const callee = node.callee;
    return types.isIdentifier(callee) && (callee.name === "require" || callee.name === "__webpack_require__");
  };

  /**
   * Find the last statement that loads a module (import or require).
   * Handles both ESM imports and CommonJS require() calls.
   */
  const findLastModuleLoader = (): NodePath<t.Statement> | null => {
    const bodyPaths = programPath.get("body");
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

  return {
    transform: (context: TransformProgramContext): TransformPassResult => {
      const metadata = collectGqlDefinitionMetadata({
        programPath,
        filename: context.filename,
      });

      const runtimeCalls: t.Expression[] = [];
      let transformed = false;

      // Transform all gql call expressions
      programPath.traverse({
        CallExpression: (callPath) => {
          const result = transformCallExpression({
            callPath,
            filename: context.filename,
            metadata,
            getArtifact: context.artifactLookup,
          });

          if (result.isErr()) {
            // Log error and continue - don't fail the entire build for a single error
            console.error(`[@soda-gql/babel-plugin] ${formatPluginError(result.error)}`);
            return;
          }

          const transformResult = result.value;
          if (transformResult.transformed) {
            transformed = true;

            if (transformResult.runtimeCall) {
              runtimeCalls.push(transformResult.runtimeCall);
            }
          }
        },
      });

      if (!transformed) {
        return { transformed: false, runtimeArtifacts: undefined };
      }

      // Ensure runtime import
      ensureGqlRuntimeImport(programPath);

      // Insert runtime side effects immediately if any
      if (runtimeCalls.length > 0) {
        const statements = runtimeCalls.map((expr) => types.expressionStatement(expr));
        const lastLoaderPath = findLastModuleLoader();

        if (lastLoaderPath) {
          lastLoaderPath.insertAfter(statements);
        } else {
          programPath.unshiftContainer("body", statements);
        }
      }

      // Clean up: remove graphql system imports and recrawl scope
      programPath.scope.crawl();
      removeGraphqlSystemImports(programPath, graphqlSystemIdentifyHelper, context.filename);

      return {
        transformed: true,
        runtimeArtifacts: undefined,
      };
    },
  };
};
