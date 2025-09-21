import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";

export const ensureImport = (programPath: NodePath<t.Program>, source: string, exportName: string, alias: string) => {
  const alreadyImported = programPath.node.body.some(
    (statement) =>
      statement.type === "ImportDeclaration" &&
      statement.source.value === source &&
      statement.specifiers.some(
        (specifier) =>
          specifier.type === "ImportSpecifier" &&
          specifier.imported.type === "Identifier" &&
          specifier.imported.name === exportName &&
          specifier.local.name === alias,
      ),
  );

  if (alreadyImported) {
    return;
  }

  programPath.node.body.unshift(
    t.importDeclaration([t.importSpecifier(t.identifier(alias), t.identifier(exportName))], t.stringLiteral(source)),
  );
};
