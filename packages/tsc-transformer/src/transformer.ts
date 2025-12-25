/**
 * TypeScript implementation of the TransformAdapter interface.
 */

import type { BuilderArtifact } from "@soda-gql/builder";
import { createGraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { CanonicalId } from "@soda-gql/common";
import type { ResolvedSodaGqlConfig } from "@soda-gql/config";
import { formatPluginError } from "@soda-gql/plugin-common";
import * as ts from "typescript";
import { ensureGqlRuntimeImport, ensureGqlRuntimeRequire, removeGraphqlSystemImports } from "./ast/imports";
import { collectGqlDefinitionMetadata } from "./ast/metadata";
import { transformCallExpression } from "./ast/transformer";

export { createAfterStubTransformer } from "./ast/imports";

/**
 * TypeScript-specific environment required for the adapter.
 */
export type TypeScriptEnv = {
  readonly sourceFile: ts.SourceFile;
  readonly context: ts.TransformationContext;
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
  compilerOptions,
  config,
  artifact,
}: {
  readonly compilerOptions: ts.CompilerOptions;
  readonly config: ResolvedSodaGqlConfig;
  readonly artifact: BuilderArtifact;
}) => {
  const isCJS = compilerOptions.module === ts.ModuleKind.CommonJS || compilerOptions.target === ts.ScriptTarget.ES5;

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

        if (result.isErr()) {
          // Log error and continue - don't fail the entire build for a single error
          console.error(`[@soda-gql/tsc-plugin] ${formatPluginError(result.error)}`);
          return node;
        }

        const transformResult = result.value;
        if (transformResult.transformed) {
          transformed = true;

          if (transformResult.runtimeCall) {
            runtimeCallsFromLastTransform.push(transformResult.runtimeCall);
          }

          return transformResult.replacement;
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    const visitedNode = ts.visitNode(sourceFile, visitor);
    if (!visitedNode || !ts.isSourceFile(visitedNode)) {
      console.error(`[@soda-gql/tsc-plugin] Failed to transform source file: ${sourceFile.fileName}`);
      return sourceFile;
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
