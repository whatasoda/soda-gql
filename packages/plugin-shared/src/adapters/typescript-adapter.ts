/**
 * TypeScript implementation of the TransformAdapter interface.
 */

import type * as ts from "typescript";
import { resolveCanonicalId } from "../cache.js";
import type { DefinitionMetadataMap, GraphQLCallAnalysis, GraphQLCallIR } from "../core/ir.js";
import type {
  TransformAdapter,
  TransformAdapterFactory,
  TransformPassResult,
  TransformProgramContext,
} from "../core/transform-adapter.js";
import type { PluginError } from "../state.js";
import { ensureGqlRuntimeImport, ensureGqlRuntimeRequire, maybeRemoveUnusedGqlImport } from "./typescript/imports.js";
import { collectGqlDefinitionMetadata } from "./typescript/metadata.js";
import { transformCallExpression } from "./typescript/transformer.js";

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
  private env: TypeScriptEnv;
  private readonly ts: typeof ts;
  private readonly factory: ts.NodeFactory;
  private runtimeCallsFromLastTransform: ts.Expression[] = [];

  constructor(env: TypeScriptEnv) {
    this.env = env;
    this.ts = env.typescript;
    this.factory = env.context.factory;
  }

  collectDefinitionMetadata(context: TransformProgramContext): DefinitionMetadataMap {
    const metadata = collectGqlDefinitionMetadata({
      sourceFile: this.env.sourceFile,
      typescript: this.ts,
      filename: context.filename,
    });

    // Convert TypeScript WeakMap to library-neutral Map with canonical IDs as keys
    const neutralMetadata: DefinitionMetadataMap = new Map();

    const visit = (node: ts.Node): void => {
      if (this.ts.isCallExpression(node)) {
        const meta = metadata.get(node);
        if (meta) {
          const canonicalId = resolveCanonicalId(context.filename, meta.astPath);
          neutralMetadata.set(canonicalId, {
            astPath: meta.astPath,
            isTopLevel: meta.isTopLevel,
            isExported: meta.isExported,
            exportBinding: meta.exportBinding,
          });
        }
      }
      this.ts.forEachChild(node, visit);
    };

    visit(this.env.sourceFile);

    return neutralMetadata;
  }

  analyzeCall(_context: TransformProgramContext, candidate: unknown): GraphQLCallAnalysis | PluginError {
    if (!this.ts.isCallExpression(candidate)) {
      throw new Error("[INTERNAL] TypeScriptAdapter.analyzeCall expects ts.CallExpression");
    }

    // This method is not yet fully implemented for TypeScript adapter
    // It would need to extract the call and convert to IR
    throw new Error("[TypeScriptAdapter] analyzeCall not yet fully implemented");
  }

  transformProgram(context: TransformProgramContext): TransformPassResult {
    const metadata = collectGqlDefinitionMetadata({
      sourceFile: this.env.sourceFile,
      typescript: this.ts,
      filename: context.filename,
    });

    // Detect module kind from compiler options
    const isCJS = this.detectCommonJSOutput(context.compilerOptions);

    // Choose runtime accessor based on module format
    const runtimeAccessor = isCJS
      ? this.factory.createPropertyAccessExpression(
          this.factory.createIdentifier("__soda_gql_runtime"),
          this.factory.createIdentifier("gqlRuntime"),
        )
      : undefined;

    this.runtimeCallsFromLastTransform = [];
    let transformed = false;

    const visitor = (node: ts.Node): ts.Node => {
      if (this.ts.isCallExpression(node)) {
        const result = transformCallExpression({
          callNode: node,
          filename: context.filename,
          metadata,
          getArtifact: context.artifactLookup,
          factory: this.factory,
          typescript: this.ts,
          runtimeAccessor,
        });

        if (result.transformed) {
          transformed = true;

          if (result.runtimeCall) {
            this.runtimeCallsFromLastTransform.push(result.runtimeCall);
          }

          return result.replacement;
        }
      }

      return this.ts.visitEachChild(node, visitor, this.env.context);
    };

    const visitedNode = this.ts.visitNode(this.env.sourceFile, visitor);
    if (!visitedNode || !this.ts.isSourceFile(visitedNode)) {
      throw new Error("[TypeScriptAdapter] Failed to transform source file");
    }

    let transformedSourceFile = visitedNode;

    if (transformed) {
      if (isCJS) {
        // For CJS: inject require statement
        transformedSourceFile = ensureGqlRuntimeRequire(transformedSourceFile, this.factory, this.ts);
      } else {
        // For ESM: ensure gqlRuntime import exists
        transformedSourceFile = ensureGqlRuntimeImport(transformedSourceFile, this.factory, this.ts);
      }

      // Remove graphql-system import (runtimeModule)
      transformedSourceFile = maybeRemoveUnusedGqlImport(transformedSourceFile, context.runtimeModule, this.factory, this.ts);
    }

    // Update the source file in env for insertRuntimeSideEffects
    this.env = { ...this.env, sourceFile: transformedSourceFile };

    return {
      transformed,
      runtimeArtifacts: undefined,
    };
  }

  insertRuntimeSideEffects(_context: TransformProgramContext, _runtimeIR: ReadonlyArray<GraphQLCallIR>): void {
    const runtimeCalls = this.runtimeCallsFromLastTransform;
    if (runtimeCalls.length === 0) {
      return;
    }

    // Wrap expressions in ExpressionStatements before insertion
    const statements = runtimeCalls.map((expr) => this.factory.createExpressionStatement(expr));

    // Find the last import statement to insert after all dependencies
    const lastImportIndex = this.findLastImportIndex();

    const existingStatements = Array.from(this.env.sourceFile.statements);
    const insertIndex = lastImportIndex + 1;

    const newStatements = [...existingStatements.slice(0, insertIndex), ...statements, ...existingStatements.slice(insertIndex)];

    // Update source file with new statements
    const updatedSourceFile = this.factory.updateSourceFile(this.env.sourceFile, newStatements);
    this.env = { ...this.env, sourceFile: updatedSourceFile };

    // Clear to prevent repeated insertions
    this.runtimeCallsFromLastTransform = [];
  }

  /**
   * Find the index of the last import statement.
   * Returns -1 if no imports found.
   */
  private findLastImportIndex(): number {
    let lastIndex = -1;
    const statements = this.env.sourceFile.statements;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement && this.ts.isImportDeclaration(statement)) {
        lastIndex = i;
      }
    }

    return lastIndex;
  }

  /**
   * Detect if the output format is CommonJS based on compiler options.
   * Uses ts.getEmitModuleKind to determine the actual output module format.
   */
  private detectCommonJSOutput(compilerOptions: unknown): boolean {
    if (!compilerOptions || typeof compilerOptions !== "object") {
      return false;
    }

    const options = compilerOptions as ts.CompilerOptions;

    // Use getEmitModuleKind if available (TypeScript 4.7+)
    if ("getEmitModuleKind" in this.ts && typeof this.ts.getEmitModuleKind === "function") {
      const emitKind = this.ts.getEmitModuleKind(options);
      return emitKind === this.ts.ModuleKind.CommonJS;
    }

    // Fallback: check module option directly
    const module = options.module;
    if (module === this.ts.ModuleKind.CommonJS) {
      return true;
    }

    // For Node16/NodeNext, check impliedNodeFormat if available
    if (module === this.ts.ModuleKind.Node16 || module === this.ts.ModuleKind.NodeNext) {
      const impliedNodeFormat = (this.env.sourceFile as unknown as { impliedNodeFormat?: number }).impliedNodeFormat;
      if (impliedNodeFormat !== undefined) {
        return impliedNodeFormat === this.ts.ModuleKind.CommonJS;
      }
    }

    return false;
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
