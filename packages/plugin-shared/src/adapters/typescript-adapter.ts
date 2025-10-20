/**
 * TypeScript implementation of the TransformAdapter interface.
 */

import type * as ts from "typescript";
import { resolveCanonicalId } from "../cache";
import type { DefinitionMetadataMap, GraphQLCallAnalysis, GraphQLCallIR } from "../core/ir";
import type {
  TransformAdapter,
  TransformAdapterFactory,
  TransformPassResult,
  TransformProgramContext,
} from "../core/transform-adapter";
import type { PluginError } from "../state";
import { ensureGqlRuntimeImport, ensureGqlRuntimeRequire, maybeRemoveUnusedGqlImport } from "./typescript/imports";
import { collectGqlDefinitionMetadata } from "./typescript/metadata";
import { transformCallExpression } from "./typescript/transformer";

export { createAfterStubTransformer } from "./typescript/imports";

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
    // Type guard to ensure candidate is a TypeScript Node
    if (!this.isTypeScriptNode(candidate)) {
      throw new Error("[INTERNAL] TypeScriptAdapter.analyzeCall expects ts.CallExpression");
    }

    if (!this.ts.isCallExpression(candidate)) {
      throw new Error("[INTERNAL] TypeScriptAdapter.analyzeCall expects ts.CallExpression");
    }

    // This method is not yet fully implemented for TypeScript adapter
    // It would need to extract the call and convert to IR
    throw new Error("[TypeScriptAdapter] analyzeCall not yet fully implemented");
  }

  /**
   * Type guard to check if a value is a TypeScript Node.
   */
  private isTypeScriptNode(candidate: unknown): candidate is ts.Node {
    return typeof candidate === "object" && candidate !== null && "kind" in candidate && "flags" in candidate;
  }

  transformProgram(context: TransformProgramContext): TransformPassResult {
    // Check if we're transforming the graphql-system file itself
    // If so, replace it with an empty module stub to prevent heavy runtime loading
    if (context.graphqlSystemFilePath) {
      // Use TypeScript's sys for file comparison
      const sys = this.ts.sys;
      if (!sys) {
        // Fallback to simple string comparison if sys is not available
        if (this.env.sourceFile.fileName === context.graphqlSystemFilePath) {
          // Create an empty module: export {};
          const emptyExport = this.factory.createExportDeclaration(
            undefined,
            false,
            this.factory.createNamedExports([]),
            undefined,
          );

          const stubSourceFile = this.factory.updateSourceFile(this.env.sourceFile, [emptyExport]);
          this.env = { ...this.env, sourceFile: stubSourceFile };

          return {
            transformed: true,
            runtimeArtifacts: undefined,
          };
        }
      } else {
        // Use canonical file name comparison
        const useCaseSensitiveFileNames = sys.useCaseSensitiveFileNames ?? false;
        const getCanonicalFileName = (fileName: string): string => {
          return useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
        };

        const toCanonical = (file: string): string => {
          const resolved = sys.resolvePath ? sys.resolvePath(file) : require("node:path").resolve(file);
          return getCanonicalFileName(resolved);
        };

        const currentFileCanonical = toCanonical(this.env.sourceFile.fileName);
        const systemFileCanonical = toCanonical(context.graphqlSystemFilePath);

        if (currentFileCanonical === systemFileCanonical) {
          // Create an empty module: export {};
          const emptyExport = this.factory.createExportDeclaration(
            undefined,
            false,
            this.factory.createNamedExports([]),
            undefined,
          );

          const stubSourceFile = this.factory.updateSourceFile(this.env.sourceFile, [emptyExport]);
          this.env = { ...this.env, sourceFile: stubSourceFile };

          return {
            transformed: true,
            runtimeArtifacts: undefined,
          };
        }
      }
    }

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
   * Uses internal TypeScript APIs if available to determine the actual output module format.
   */
  private detectCommonJSOutput(compilerOptions: unknown): boolean {
    if (!compilerOptions || typeof compilerOptions !== "object") {
      return false;
    }

    const options = compilerOptions as ts.CompilerOptions;

    // Try accessing internal API via type assertion
    // TypeScript has getEmitModuleKind in internal APIs but not in public types
    const tsInternal = this.ts as typeof ts & {
      getEmitModuleKind?: (options: ts.CompilerOptions) => ts.ModuleKind;
    };

    if (tsInternal.getEmitModuleKind) {
      try {
        const emitKind = tsInternal.getEmitModuleKind(options);
        return emitKind === this.ts.ModuleKind.CommonJS;
      } catch {
        // Fall through to fallback logic
      }
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
