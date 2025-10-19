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
 * Remove unused gql import from the source file if it's no longer referenced.
 * Note: TypeScript doesn't have a built-in scope/binding API like Babel,
 * so this is a simplified implementation that checks for basic usage.
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

  // Check if gql is used in the file
  let gqlIsUsed = false;
  const visit = (node: ts.Node): void => {
    if (typescript.isIdentifier(node) && node.text === "gql") {
      // Check if this identifier is not part of the import declaration itself
      if (node.parent !== gqlImport.importClause?.namedBindings) {
        gqlIsUsed = true;
      }
    }
    if (!gqlIsUsed) {
      typescript.forEachChild(node, visit);
    }
  };

  visit(sourceFile);

  if (gqlIsUsed) {
    return sourceFile;
  }

  // Remove gql from import specifiers
  const remainingSpecifiers = gqlImport.importClause.namedBindings.elements.filter((element) => element.name.text !== "gql");

  if (remainingSpecifiers.length === 0) {
    // Remove entire import declaration
    const newStatements = sourceFile.statements.filter((stmt) => stmt !== gqlImport);
    return factory.updateSourceFile(sourceFile, newStatements);
  }

  // Update import with remaining specifiers
  const newNamedBindings = factory.createNamedImports(remainingSpecifiers);
  const newImportClause = factory.createImportClause(false, undefined, newNamedBindings);
  const newImportDeclaration = factory.createImportDeclaration(
    undefined,
    newImportClause,
    gqlImport.moduleSpecifier,
    undefined,
  );

  const newStatements = sourceFile.statements.map((stmt) => (stmt === gqlImport ? newImportDeclaration : stmt));
  return factory.updateSourceFile(sourceFile, newStatements);
};
