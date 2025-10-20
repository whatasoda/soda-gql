/**
 * TypeScript implementation of the TransformAdapter interface.
 */

import { resolve } from "node:path";
import type { BuilderArtifact, CanonicalId } from "@soda-gql/builder";
import { resolveRelativeImportWithExistenceCheck } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import * as ts from "typescript";
import {
  ensureGqlRuntimeImport,
  ensureGqlRuntimeRequire,
  type GraphqlSystemIdentifyHelper,
  removeGraphqlSystemImports,
} from "./internal/ts-adapter/typescript/imports.js";
import { collectGqlDefinitionMetadata } from "./internal/ts-adapter/typescript/metadata.js";
import { transformCallExpression } from "./internal/ts-adapter/typescript/transformer.js";

export { createAfterStubTransformer } from "./internal/ts-adapter/typescript/imports.js";

/**
 * TypeScript-specific environment required for the adapter.
 */
export type TypeScriptEnv = {
  readonly sourceFile: ts.SourceFile;
  readonly context: ts.TransformationContext;
};

const tsInternals = ts as unknown as {
  createGetCanonicalFileName: (useCaseSensitiveFileNames: boolean) => (path: string) => string;
  getEmitModuleKind: (compilerOptions: ts.CompilerOptions) => ts.ModuleKind.CommonJS | ts.ModuleKind.ES2015;
};

const findLastImportIndex = ({ sourceFile }: { sourceFile: ts.SourceFile }): number => {
  let lastIndex = -1;
  const statements = sourceFile.statements;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement && ts.isImportDeclaration(statement)) {
      lastIndex = i;
    }
  }

  return lastIndex;
};

export const createBeforeTransformer = ({
  program,
  config,
  artifact,
}: {
  readonly program: ts.Program;
  readonly config: ResolvedSodaGqlConfig;
  readonly artifact: BuilderArtifact;
}) => {
  const compilerOptions = program.getCompilerOptions();
  const isCJS = tsInternals.getEmitModuleKind(compilerOptions) === ts.ModuleKind.CommonJS;

  // Use TypeScript's canonical file name comparison to handle casing, symlinks, etc.
  const getCanonicalFileName = tsInternals.createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames);
  const toCanonical = (file: string): string => {
    const resolved = ts.sys.resolvePath ? ts.sys.resolvePath(file) : resolve(file);
    return getCanonicalFileName(resolved);
  };

  const graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper = {
    isGraphqlSystemFile: ({ filePath }: { filePath: string }) => {
      return toCanonical(filePath) === toCanonical(config.graphqlSystemPath);
    },
    isGraphqlSystemImportSpecifier: ({ filePath, specifier }: { filePath: string; specifier: string }) => {
      if (config.graphqlSystemAlias) {
        return toCanonical(specifier) === toCanonical(config.graphqlSystemAlias);
      }

      const resolved = resolveRelativeImportWithExistenceCheck({ filePath, specifier });
      if (!resolved) {
        return false;
      }

      return toCanonical(resolved) === toCanonical(config.graphqlSystemPath);
    },
  };

  const makeSourceFileEmpty = ({ factory, sourceFile }: { factory: ts.NodeFactory; sourceFile: ts.SourceFile }) => {
    return factory.updateSourceFile(sourceFile, [
      factory.createExportDeclaration(undefined, false, factory.createNamedExports([]), undefined),
    ]);
  };

  const transformGqlCalls = ({ sourceFile, context }: { sourceFile: ts.SourceFile; context: ts.TransformationContext }) => {
    let transformed = false;

    const metadata = collectGqlDefinitionMetadata({
      sourceFile,
      filename: sourceFile.fileName,
    });

    const runtimeCallsFromLastTransform: ts.Expression[] = [];
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isCallExpression(node)) {
        const result = transformCallExpression({
          callNode: node,
          filename: sourceFile.fileName,
          metadata,
          getArtifact: (canonicalId: CanonicalId) => artifact.elements[canonicalId],
          factory: context.factory,
          isCJS,
        });

        if (result.transformed) {
          transformed = true;

          if (result.runtimeCall) {
            runtimeCallsFromLastTransform.push(result.runtimeCall);
          }

          return result.replacement;
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    const visitedNode = ts.visitNode(sourceFile, visitor);
    if (!visitedNode || !ts.isSourceFile(visitedNode)) {
      throw new Error("[TypeScriptAdapter] Failed to transform source file");
    }

    if (!transformed) {
      return sourceFile;
    }

    if (runtimeCallsFromLastTransform.length === 0) {
      return visitedNode;
    }

    const lastImportIndex = findLastImportIndex({ sourceFile });

    return context.factory.updateSourceFile(visitedNode, [
      ...visitedNode.statements.slice(0, lastImportIndex + 1),
      ...runtimeCallsFromLastTransform.map((expr) => context.factory.createExpressionStatement(expr)),
      ...visitedNode.statements.slice(lastImportIndex + 1),
    ]);
  };

  return {
    transform: ({ sourceFile, context }: { sourceFile: ts.SourceFile; context: ts.TransformationContext }) => {
      if (graphqlSystemIdentifyHelper.isGraphqlSystemFile({ filePath: sourceFile.fileName })) {
        const transformedSourceFile = makeSourceFileEmpty({ factory: context.factory, sourceFile: sourceFile });
        return { transformed: true, sourceFile: transformedSourceFile };
      }

      const original = sourceFile;
      let current = sourceFile;
      current = transformGqlCalls({ sourceFile: current, context });

      if (current !== sourceFile) {
        current = isCJS
          ? ensureGqlRuntimeRequire({ sourceFile: current, factory: context.factory })
          : ensureGqlRuntimeImport({ sourceFile: current, factory: context.factory });
      }

      current = removeGraphqlSystemImports({
        sourceFile: current,
        factory: context.factory,
        graphqlSystemIdentifyHelper,
      });

      return { transformed: current !== original, sourceFile: current };
    },
  };
};
