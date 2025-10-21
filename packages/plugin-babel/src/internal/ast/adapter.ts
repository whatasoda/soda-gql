/**
 * Babel implementation of the TransformAdapter interface.
 *
 * This adapter wraps the existing Babel-specific transformation logic
 * for soda-gql zero-runtime transformations.
 */

import type { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { TransformAdapter, TransformAdapterFactory, TransformPassResult, TransformProgramContext } from "../types";
import { ensureGqlRuntimeImport, maybeRemoveUnusedGqlImport } from "./imports";
import { collectGqlDefinitionMetadata } from "./metadata";
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
      maybeRemoveUnusedGqlImport(this.env.programPath, context.runtimeModule);
    }

    return {
      transformed,
      runtimeArtifacts: undefined,
    };
  }

  insertRuntimeSideEffects(_context: TransformProgramContext, _runtimeIR: ReadonlyArray<unknown>): void {
    // Use internally tracked runtime calls from transformProgram
    const runtimeCalls = this.runtimeCallsFromLastTransform;
    if (runtimeCalls.length === 0) {
      return;
    }

    // Wrap expressions in ExpressionStatements before insertion
    const statements = runtimeCalls.map((expr) => this.env.types.expressionStatement(expr));

    // Find the last import/require statement to insert after all dependencies
    const lastLoaderPath = this.findLastModuleLoader();

    if (lastLoaderPath) {
      lastLoaderPath.insertAfter(statements);
    } else {
      // Fallback: insert at the beginning if no loaders found
      this.env.programPath.unshiftContainer("body", statements);
    }

    // Clear to prevent repeated insertions
    this.runtimeCallsFromLastTransform = [];
  }

  /**
   * Find the last statement that loads a module (import or require).
   * Handles both ESM imports and CommonJS require() calls.
   */
  private findLastModuleLoader(): NodePath<t.Statement> | null {
    const bodyPaths = this.env.programPath.get("body");
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
          if (declarator.init && this.isRequireCall(declarator.init)) {
            lastLoader = path;
            break;
          }
        }
        continue;
      }

      // CommonJS: require("bar") or __webpack_require__(123) as standalone expression
      if (path.isExpressionStatement()) {
        if (this.isRequireCall(path.node.expression)) {
          lastLoader = path;
        }
      }
    }

    return lastLoader;
  }

  /**
   * Check if a node is a require() or __webpack_require__() call.
   */
  private isRequireCall(node: t.Node): boolean {
    if (!this.env.types.isCallExpression(node)) {
      return false;
    }

    const callee = node.callee;
    return this.env.types.isIdentifier(callee) && (callee.name === "require" || callee.name === "__webpack_require__");
  }
}

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
