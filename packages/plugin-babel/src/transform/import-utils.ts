import type { types as BabelTypes, NodePath } from "@babel/core";
import * as t from "@babel/types";
import type { PluginPassState } from "../types";

export const ensureGqlRuntimeImport = (
  path: NodePath<BabelTypes.Program>,
  state: PluginPassState,
  runtimeImportPath: string,
): BabelTypes.Identifier => {
  const programPath = path.scope.getProgramParent().path as NodePath<BabelTypes.Program>;
  const existingImport = programPath.node.body.find(
    (stmt): stmt is BabelTypes.ImportDeclaration => t.isImportDeclaration(stmt) && stmt.source.value === runtimeImportPath,
  );

  if (existingImport) {
    const defaultSpecifier = existingImport.specifiers.find((spec): spec is BabelTypes.ImportDefaultSpecifier =>
      t.isImportDefaultSpecifier(spec),
    );
    if (defaultSpecifier) {
      return defaultSpecifier.local;
    }
  }

  const runtimeId = path.scope.generateUidIdentifier("gql");
  const importDeclaration = t.importDeclaration([t.importDefaultSpecifier(runtimeId)], t.stringLiteral(runtimeImportPath));
  programPath.unshiftContainer("body", importDeclaration);
  state.runtimeImportAdded = true;
  return runtimeId;
};

export const maybeRemoveUnusedGqlImport = (path: NodePath<BabelTypes.Program>, state: PluginPassState): void => {
  if (!state.runtimeImportAdded || state.replacements > 0) return;

  const importIndex = path.node.body.findIndex(
    (stmt) => t.isImportDeclaration(stmt) && stmt.source.value === state.options.importIdentifier,
  );

  if (importIndex !== -1) {
    path.node.body.splice(importIndex, 1);
  }
};
