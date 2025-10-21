/**
 * TypeScript implementation of the TransformAdapter interface.
 */

import type { BuilderArtifact, CanonicalId } from "@soda-gql/builder";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import * as ts from "typescript";
import { ensureGqlRuntimeImport, ensureGqlRuntimeRequire, removeGraphqlSystemImports } from "./internal/ast/imports";
import { collectGqlDefinitionMetadata } from "./internal/ast/metadata";
import { transformCallExpression } from "./internal/ast/transformer";

export { createAfterStubTransformer } from "./internal/ast/imports";

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

export const createTransformer = ({
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

  // Create graphql system identify helper using builder's implementation
  const graphqlSystemIdentifyHelper = createGraphqlSystemIdentifyHelper(config);

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
