import type * as ts from "typescript";

/**
 * Ensure that the gqlRuntime import exists in the source file.
 * Returns an updated source file with the import added or merged.
 */
export const ensureGqlRuntimeImport = (
  sourceFile: ts.SourceFile,
  runtimeModule: string,
  factory: ts.NodeFactory,
  typescript: typeof ts,
): ts.SourceFile => {
  const existing = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      typescript.isImportDeclaration(statement) &&
      typescript.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === runtimeModule,
  );

  if (existing && existing.importClause && existing.importClause.namedBindings && typescript.isNamedImports(existing.importClause.namedBindings)) {
    const hasSpecifier = existing.importClause.namedBindings.elements.some(
      (element) => element.name.text === "gqlRuntime",
    );

    if (hasSpecifier) {
      return sourceFile;
    }

    // Add gqlRuntime to existing import
    const newElements = [
      ...existing.importClause.namedBindings.elements,
      factory.createImportSpecifier(false, undefined, factory.createIdentifier("gqlRuntime")),
    ];

    const newNamedBindings = factory.createNamedImports(newElements);
    const newImportClause = factory.createImportClause(false, undefined, newNamedBindings);
    const newImportDeclaration = factory.createImportDeclaration(
      undefined,
      newImportClause,
      factory.createStringLiteral(runtimeModule),
      undefined,
    );

    const newStatements = sourceFile.statements.map((stmt) => (stmt === existing ? newImportDeclaration : stmt));
    return factory.updateSourceFile(sourceFile, newStatements);
  }

  // Create new import declaration
  const newImportDeclaration = factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamedImports([factory.createImportSpecifier(false, undefined, factory.createIdentifier("gqlRuntime"))]),
    ),
    factory.createStringLiteral(runtimeModule),
    undefined,
  );

  const newStatements = [newImportDeclaration, ...sourceFile.statements];
  return factory.updateSourceFile(sourceFile, newStatements);
};

/**
 * Remove unused gql import and exports from the source file if they're no longer referenced.
 * This removes both the import statement and any export statements that reference gql definitions.
 */
export const maybeRemoveUnusedGqlImport = (
  sourceFile: ts.SourceFile,
  factory: ts.NodeFactory,
  typescript: typeof ts,
): ts.SourceFile => {
  // Find the gql import
  const gqlImport = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      typescript.isImportDeclaration(statement) &&
      statement.importClause &&
      statement.importClause.namedBindings &&
      typescript.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some((element) => element.name.text === "gql"),
  );

  if (!gqlImport || !gqlImport.importClause || !gqlImport.importClause.namedBindings || !typescript.isNamedImports(gqlImport.importClause.namedBindings)) {
    return sourceFile;
  }

  // Check if gql is used in the file (excluding imports and exports)
  let gqlIsUsed = false;
  const visit = (node: ts.Node): void => {
    if (typescript.isIdentifier(node) && node.text === "gql") {
      // Skip if this is part of the import declaration
      if (node.parent === gqlImport.importClause?.namedBindings) {
        return;
      }

      // Skip if this is part of an export declaration
      let parent = node.parent;
      while (parent) {
        if (typescript.isExportDeclaration(parent) || typescript.isExportAssignment(parent)) {
          return;
        }
        parent = parent.parent;
      }

      gqlIsUsed = true;
    }
    if (!gqlIsUsed) {
      typescript.forEachChild(node, visit);
    }
  };

  visit(sourceFile);

  if (gqlIsUsed) {
    return sourceFile;
  }

  // gql is not used, so remove import and related exports
  let updatedStatements = Array.from(sourceFile.statements);

  // Remove gql-related exports
  updatedStatements = updatedStatements.filter((statement) => {
    // Remove export { foo } where foo was defined using gql
    if (typescript.isExportDeclaration(statement) && statement.exportClause && typescript.isNamedExports(statement.exportClause)) {
      // Check if any exported identifier is from a gql.default() call
      const hasGqlExports = statement.exportClause.elements.some((element) => {
        const name = (element.propertyName || element.name).text;
        // Find the variable declaration for this export
        const declaration = sourceFile.statements.find(
          (stmt): stmt is ts.VariableStatement =>
            typescript.isVariableStatement(stmt) &&
            stmt.declarationList.declarations.some(
              (decl) => typescript.isIdentifier(decl.name) && decl.name.text === name && decl.initializer && isGqlCall(decl.initializer, typescript),
            ),
        );
        return !!declaration;
      });

      // Remove this export declaration if all its exports are gql-related
      if (hasGqlExports) {
        return false;
      }
    }

    // Remove variable statements that define gql calls but are no longer exported
    if (typescript.isVariableStatement(statement)) {
      // Check if this variable is exported
      const hasExportModifier = statement.modifiers?.some((m) => m.kind === typescript.SyntaxKind.ExportKeyword);

      if (hasExportModifier) {
        // Check if the declaration is a gql call
        const hasGqlDeclaration = statement.declarationList.declarations.some(
          (decl) => decl.initializer && isGqlCall(decl.initializer, typescript),
        );

        if (hasGqlDeclaration) {
          return false;
        }
      }
    }

    return true;
  });

  // Remove gql from import specifiers
  const remainingSpecifiers = gqlImport.importClause.namedBindings.elements.filter((element) => element.name.text !== "gql");

  if (remainingSpecifiers.length === 0) {
    // Remove entire import declaration
    updatedStatements = updatedStatements.filter((stmt) => stmt !== gqlImport);
  } else {
    // Update import with remaining specifiers
    const newNamedBindings = factory.createNamedImports(remainingSpecifiers);
    const newImportClause = factory.createImportClause(false, undefined, newNamedBindings);
    const newImportDeclaration = factory.createImportDeclaration(
      undefined,
      newImportClause,
      gqlImport.moduleSpecifier,
      undefined,
    );
    updatedStatements = updatedStatements.map((stmt) => (stmt === gqlImport ? newImportDeclaration : stmt));
  }

  return factory.updateSourceFile(sourceFile, updatedStatements);
};

/**
 * Check if an expression is a gql.default() or gql.* call
 */
const isGqlCall = (expr: ts.Expression, typescript: typeof ts): boolean => {
  if (!typescript.isCallExpression(expr)) {
    return false;
  }

  if (!typescript.isPropertyAccessExpression(expr.expression)) {
    return false;
  }

  return isGqlReference(expr.expression.expression, typescript);
};

/**
 * Check if an expression references 'gql'
 */
const isGqlReference = (expr: ts.Expression, typescript: typeof ts): boolean => {
  if (typescript.isIdentifier(expr) && expr.text === "gql") {
    return true;
  }
  if (!typescript.isPropertyAccessExpression(expr)) {
    return false;
  }
  if (typescript.isIdentifier(expr.name) && expr.name.text === "gql") {
    return true;
  }
  return isGqlReference(expr.expression, typescript);
};
