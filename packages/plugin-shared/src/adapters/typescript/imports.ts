import type * as ts from "typescript";

const RUNTIME_MODULE = "@soda-gql/runtime";

/**
 * Ensure that the gqlRuntime require exists in the source file for CJS output.
 * Injects: const __soda_gql_runtime = require("@soda-gql/runtime");
 * Returns an updated source file with the require added if needed.
 */
export const ensureGqlRuntimeRequire = (
  sourceFile: ts.SourceFile,
  factory: ts.NodeFactory,
  typescript: typeof ts,
): ts.SourceFile => {
  // Check if the require already exists
  const existing = sourceFile.statements.find(
    (statement): statement is ts.VariableStatement =>
      typescript.isVariableStatement(statement) &&
      statement.declarationList.declarations.some((decl) => {
        if (!typescript.isIdentifier(decl.name) || decl.name.text !== "__soda_gql_runtime") {
          return false;
        }
        if (!decl.initializer || !typescript.isCallExpression(decl.initializer)) {
          return false;
        }
        const callExpr = decl.initializer;
        if (!typescript.isIdentifier(callExpr.expression) || callExpr.expression.text !== "require") {
          return false;
        }
        const arg = callExpr.arguments[0];
        return arg && typescript.isStringLiteral(arg) && arg.text === RUNTIME_MODULE;
      }),
  );

  if (existing) {
    return sourceFile;
  }

  // Create: const __soda_gql_runtime = require("@soda-gql/runtime");
  const requireCall = factory.createCallExpression(factory.createIdentifier("require"), undefined, [
    factory.createStringLiteral(RUNTIME_MODULE),
  ]);

  const variableDeclaration = factory.createVariableDeclaration(
    factory.createIdentifier("__soda_gql_runtime"),
    undefined,
    undefined,
    requireCall,
  );

  const variableStatement = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList([variableDeclaration], typescript.NodeFlags.Const),
  );

  // Insert at the beginning of the file
  const newStatements = [variableStatement, ...sourceFile.statements];
  return factory.updateSourceFile(sourceFile, newStatements);
};

/**
 * Ensure that the gqlRuntime import exists in the source file.
 * gqlRuntime is always imported from @soda-gql/runtime.
 * Returns an updated source file with the import added or merged.
 */
export const ensureGqlRuntimeImport = (
  sourceFile: ts.SourceFile,
  factory: ts.NodeFactory,
  typescript: typeof ts,
): ts.SourceFile => {
  const existing = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      typescript.isImportDeclaration(statement) &&
      typescript.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === RUNTIME_MODULE,
  );

  if (
    existing &&
    existing.importClause &&
    existing.importClause.namedBindings &&
    typescript.isNamedImports(existing.importClause.namedBindings)
  ) {
    const hasSpecifier = existing.importClause.namedBindings.elements.some((element) => element.name.text === "gqlRuntime");

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
      factory.createStringLiteral(RUNTIME_MODULE),
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
    factory.createStringLiteral(RUNTIME_MODULE),
    undefined,
  );

  const newStatements = [newImportDeclaration, ...sourceFile.statements];
  return factory.updateSourceFile(sourceFile, newStatements);
};

/**
 * Remove the graphql-system import (runtimeModule) and gql-related exports from the source file.
 * After transformation, gqlRuntime is imported from @soda-gql/runtime instead,
 * so the original graphql-system import should be completely removed.
 */
export const maybeRemoveUnusedGqlImport = (
  sourceFile: ts.SourceFile,
  runtimeModule: string,
  factory: ts.NodeFactory,
  typescript: typeof ts,
): ts.SourceFile => {
  // Find the graphql-system import (the runtimeModule, e.g., "@/graphql-system")
  const gqlImport = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      typescript.isImportDeclaration(statement) &&
      typescript.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === runtimeModule,
  );

  if (!gqlImport) {
    return sourceFile;
  }

  // After transformation, all gql usage should be replaced with gqlRuntime
  // So we can safely remove the graphql-system import and all gql-related exports
  let updatedStatements = Array.from(sourceFile.statements);

  // Remove gql-related exports
  updatedStatements = updatedStatements.filter((statement) => {
    // Remove export { foo } where foo was defined using gql
    if (
      typescript.isExportDeclaration(statement) &&
      statement.exportClause &&
      typescript.isNamedExports(statement.exportClause)
    ) {
      // Check if any exported identifier is from a gql.default() call
      const hasGqlExports = statement.exportClause.elements.some((element) => {
        const name = (element.propertyName || element.name).text;
        // Find the variable declaration for this export
        const declaration = sourceFile.statements.find(
          (stmt): stmt is ts.VariableStatement =>
            typescript.isVariableStatement(stmt) &&
            stmt.declarationList.declarations.some(
              (decl) =>
                typescript.isIdentifier(decl.name) &&
                decl.name.text === name &&
                decl.initializer &&
                isGqlCall(decl.initializer, typescript),
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

  // Remove the entire graphql-system import declaration
  // (After transformation, we use @soda-gql/runtime instead)
  updatedStatements = updatedStatements.filter((stmt) => stmt !== gqlImport);

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
