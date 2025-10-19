import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";

export const ensureGqlRuntimeImport = (programPath: NodePath<t.Program>) => {
  const existing = programPath.node.body.find(
    (statement) => statement.type === "ImportDeclaration" && statement.source.value === "@soda-gql/runtime",
  );

  if (existing && t.isImportDeclaration(existing)) {
    const hasSpecifier = existing.specifiers.some(
      (specifier) =>
        specifier.type === "ImportSpecifier" &&
        specifier.imported.type === "Identifier" &&
        specifier.imported.name === "gqlRuntime",
    );

    if (!hasSpecifier) {
      existing.specifiers = [...existing.specifiers, t.importSpecifier(t.identifier("gqlRuntime"), t.identifier("gqlRuntime"))];
    }

    return;
  }

  programPath.node.body.unshift(
    t.importDeclaration(
      [t.importSpecifier(t.identifier("gqlRuntime"), t.identifier("gqlRuntime"))],
      t.stringLiteral("@soda-gql/runtime"),
    ),
  );
};

export const maybeRemoveUnusedGqlImport = (programPath: NodePath<t.Program>, runtimeModule: string) => {
  // Find and remove the graphql-system import (runtimeModule)
  // After transformation, we use @soda-gql/runtime instead
  programPath.traverse({
    ImportDeclaration(path) {
      if (path.node.source.value === runtimeModule) {
        path.remove();
      }
    },
  });
};
