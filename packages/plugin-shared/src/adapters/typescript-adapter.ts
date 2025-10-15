/**
 * TypeScript implementation of the TransformAdapter interface.
 *
 * This is a minimal initial implementation that handles the core zero-runtime transformation.
 * Future iterations can add richer metadata collection and analysis parity with Babel adapter.
 */

import type * as ts from "typescript";
import type { DefinitionMetadataMap, GraphQLCallAnalysis, GraphQLCallIR } from "../core/ir.js";
import type {
  TransformAdapter,
  TransformAdapterFactory,
  TransformPassResult,
  TransformProgramContext,
} from "../core/transform-adapter.js";
import type { PluginError } from "../state.js";

/**
 * TypeScript-specific environment required for the adapter.
 */
export type TypeScriptEnv = {
  readonly sourceFile: ts.SourceFile;
  readonly context: ts.TransformationContext;
  readonly typescript: typeof ts;
};

/**
 * TypeScript implementation of TransformAdapter.
 */
export class TypeScriptAdapter implements TransformAdapter {
  private readonly env: TypeScriptEnv;
  private readonly ts: typeof ts;
  private readonly factory: ts.NodeFactory;
  private runtimeCallsFromLastTransform: ts.Expression[] = [];

  constructor(env: TypeScriptEnv) {
    this.env = env;
    this.ts = env.typescript;
    this.factory = env.context.factory;
  }

  /**
   * Collect metadata about GraphQL definitions.
   * TODO: Implement full metadata collection in future iteration.
   */
  collectDefinitionMetadata(_context: TransformProgramContext): DefinitionMetadataMap {
    // Minimal implementation - return empty map for now
    return new Map();
  }

  /**
   * Analyze a candidate call expression.
   * TODO: Implement full call analysis in future iteration.
   */
  analyzeCall(_context: TransformProgramContext, _candidate: unknown): GraphQLCallAnalysis | PluginError {
    throw new Error("[TypeScriptAdapter] analyzeCall not yet implemented");
  }

  /**
   * Transform the entire program, replacing GraphQL calls with runtime equivalents.
   */
  transformProgram(context: TransformProgramContext): TransformPassResult {
    this.runtimeCallsFromLastTransform = [];
    let transformed = false;

    const visitor = (node: ts.Node): ts.Node => {
      // Handle CallExpression nodes
      if (this.ts.isCallExpression(node)) {
        const gqlCall = this.detectGqlOperationCall(node);
        if (gqlCall) {
          transformed = true;
          // For now, just track that we found a call
          // Actual transformation will be added in next iteration
          return node;
        }
      }

      return this.ts.visitEachChild(node, visitor, this.env.context);
    };

    const transformedSourceFile = this.ts.visitNode(this.env.sourceFile, visitor);
    if (!transformedSourceFile || !this.ts.isSourceFile(transformedSourceFile)) {
      throw new Error("[TypeScriptAdapter] Failed to transform source file");
    }

    // Update the source file in env for insertRuntimeSideEffects
    (this.env as { sourceFile: ts.SourceFile }).sourceFile = transformedSourceFile;

    return {
      transformed,
      runtimeArtifacts: undefined,
    };
  }

  /**
   * Insert runtime side effects (operation registrations) into the program.
   */
  insertRuntimeSideEffects(context: TransformProgramContext, _runtimeIR: ReadonlyArray<GraphQLCallIR>): void {
    const runtimeCalls = this.runtimeCallsFromLastTransform;
    if (runtimeCalls.length === 0) {
      return;
    }

    // Create runtime import statement
    const importIdentifier = context.filename; // TODO: Get from state.options.importIdentifier
    const runtimeImport = this.factory.createImportDeclaration(
      undefined,
      this.factory.createImportClause(
        false,
        undefined,
        this.factory.createNamedImports([
          this.factory.createImportSpecifier(false, undefined, this.factory.createIdentifier("gqlRuntime")),
        ]),
      ),
      this.factory.createStringLiteral(importIdentifier),
    );

    // Wrap runtime calls in expression statements
    const statements = runtimeCalls.map((expr) => this.factory.createExpressionStatement(expr));

    // Find insertion point after imports
    const existingStatements = Array.from(this.env.sourceFile.statements);
    let insertIndex = 0;
    for (let i = 0; i < existingStatements.length; i++) {
      const stmt = existingStatements[i];
      if (stmt && this.ts.isImportDeclaration(stmt)) {
        insertIndex = i + 1;
      } else {
        break;
      }
    }

    // Insert runtime import and calls
    const newStatements = [
      ...existingStatements.slice(0, insertIndex),
      runtimeImport,
      ...statements,
      ...existingStatements.slice(insertIndex),
    ];

    // Update source file with new statements
    const updatedSourceFile = this.factory.updateSourceFile(this.env.sourceFile, newStatements);
    (this.env as { sourceFile: ts.SourceFile }).sourceFile = updatedSourceFile;

    // Clear to prevent repeated insertions
    this.runtimeCallsFromLastTransform = [];
  }

  /**
   * Detect if a call expression is a gql.operation.* call.
   * Returns the operation kind if detected, null otherwise.
   */
  private detectGqlOperationCall(node: ts.CallExpression): string | null {
    // Match pattern: gql.operation.<kind>(...)
    // node.expression should be PropertyAccessExpression: operation.<kind>
    if (!this.ts.isPropertyAccessExpression(node.expression)) {
      return null;
    }

    const kindProperty = node.expression;
    const kind = kindProperty.name.text;

    // Check if supported kind
    const supportedKinds = ["query", "mutation", "subscription", "fragment"];
    if (!supportedKinds.includes(kind)) {
      return null;
    }

    // kindProperty.expression should be PropertyAccessExpression: gql.operation
    if (!this.ts.isPropertyAccessExpression(kindProperty.expression)) {
      return null;
    }

    const operationProperty = kindProperty.expression;
    if (operationProperty.name.text !== "operation") {
      return null;
    }

    // operationProperty.expression should be Identifier: gql
    if (!this.ts.isIdentifier(operationProperty.expression)) {
      return null;
    }

    if (operationProperty.expression.text !== "gql") {
      return null;
    }

    return kind;
  }
}

/**
 * Factory for creating TypeScriptAdapter instances.
 */
export const typescriptTransformAdapterFactory: TransformAdapterFactory = {
  id: "typescript",
  create(env: unknown): TypeScriptAdapter {
    if (!isTypeScriptEnv(env)) {
      throw new Error("[INTERNAL] TypeScriptAdapter requires TypeScriptEnv");
    }
    return new TypeScriptAdapter(env);
  },
};

/**
 * Type guard for TypeScriptEnv.
 */
const isTypeScriptEnv = (env: unknown): env is TypeScriptEnv => {
  return typeof env === "object" && env !== null && "sourceFile" in env && "context" in env && "typescript" in env;
};
