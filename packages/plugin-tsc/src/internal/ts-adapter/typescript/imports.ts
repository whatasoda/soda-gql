import type * as tsType from "typescript";
import ts from "typescript";

const RUNTIME_MODULE = "@soda-gql/runtime";

/**
 * Ensure that the gqlRuntime require exists in the source file for CJS output.
 * Injects: const __soda_gql_runtime = require("@soda-gql/runtime");
 * Returns an updated source file with the require added if needed.
 */
export const ensureGqlRuntimeRequire = (
  sourceFile: ts.SourceFile,
  factory: ts.NodeFactory,
  typescript: typeof tsType,
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
  typescript: typeof tsType,
): ts.SourceFile => {
  const existing = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      typescript.isImportDeclaration(statement) &&
      typescript.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === RUNTIME_MODULE,
  );

  if (existing?.importClause?.namedBindings && typescript.isNamedImports(existing.importClause.namedBindings)) {
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
 *
 * This handles both ESM imports and CommonJS require() statements (including interop helpers).
 */
export const maybeRemoveUnusedGqlImport = (
  sourceFile: ts.SourceFile,
  runtimeModule: string,
  factory: ts.NodeFactory,
  typescript: typeof tsType,
): ts.SourceFile => {
  // Find the graphql-system import (the runtimeModule, e.g., "@/graphql-system")
  const gqlImport = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      typescript.isImportDeclaration(statement) &&
      typescript.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === runtimeModule,
  );

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

  // Remove the ESM import declaration for the runtimeModule
  if (gqlImport) {
    updatedStatements = updatedStatements.filter((stmt) => stmt !== gqlImport);
  }

  // Remove CommonJS require() statements for the runtimeModule
  // TypeScript emits these when downleveling ESM to CJS:
  // - const graphql_system_1 = require("../../graphql-system");
  // - const { gql } = require("@/graphql-system");
  // - const foo = __importDefault(require("@/graphql-system"));
  // - const foo = __importStar(require("@/graphql-system"));
  updatedStatements = updatedStatements.filter((statement) => {
    if (!typescript.isVariableStatement(statement)) {
      return true;
    }

    // Check if all declarations in this statement are require() calls for runtimeModule
    const allDeclarationsAreRuntimeModuleRequires = statement.declarationList.declarations.every((decl) =>
      isRequireOfRuntimeModule(decl.initializer, runtimeModule, typescript),
    );

    // Remove the entire statement if all declarations are for the runtimeModule
    return !allDeclarationsAreRuntimeModuleRequires;
  });

  return factory.updateSourceFile(sourceFile, updatedStatements);
};

/**
 * Check if an expression is a gql.default() or gql.* call
 */
const isGqlCall = (expr: ts.Expression, typescript: typeof tsType): boolean => {
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
const isGqlReference = (expr: ts.Expression, typescript: typeof tsType): boolean => {
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

/**
 * Create an "after" transformer that stubs out require() calls for the runtimeModule.
 * This runs after TypeScript's own transformers (including CommonJS downleveling),
 * so we can replace `const X = require("@/graphql-system")` with a lightweight stub.
 *
 * This prevents the heavy graphql-system module from being loaded at runtime.
 */
export const createAfterStubTransformer = (
  runtimeModule: string,
  typescript: typeof tsType,
): ts.TransformerFactory<ts.SourceFile> => {
  return (context) => {
    const factory = context.factory;

    const visitor = (node: ts.Node): ts.Node => {
      // Replace variable statements that require the runtimeModule with a stub
      if (typescript.isVariableStatement(node)) {
        const declarations = node.declarationList.declarations;

        // Check if any declaration requires the runtimeModule
        const hasRuntimeModuleRequire = declarations.some((decl) =>
          isRequireOfRuntimeModule(decl.initializer, runtimeModule, typescript),
        );

        if (hasRuntimeModuleRequire) {
          // Replace all declarations that require runtimeModule with a stub
          const newDeclarations = declarations.map((decl) => {
            if (isRequireOfRuntimeModule(decl.initializer, runtimeModule, typescript)) {
              // Create stub: const X = /*#__PURE__*/Object.create(null);
              const stub = factory.createCallExpression(
                factory.createPropertyAccessExpression(factory.createIdentifier("Object"), "create"),
                undefined,
                [factory.createNull()],
              );

              // Add /*#__PURE__*/ comment for tree-shaking
              ts.addSyntheticLeadingComment(stub, ts.SyntaxKind.MultiLineCommentTrivia, "#__PURE__", false);

              return factory.updateVariableDeclaration(decl, decl.name, decl.exclamationToken, decl.type, stub);
            }
            return decl;
          });

          return factory.updateVariableStatement(
            node,
            node.modifiers,
            factory.updateVariableDeclarationList(node.declarationList, newDeclarations),
          );
        }
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return (sourceFile) => ts.visitNode(sourceFile, visitor) as ts.SourceFile;
  };
};

/**
 * Check if an expression is a require() call for the runtimeModule.
 * Handles multiple patterns:
 * - require("@/graphql-system")
 * - __importDefault(require("@/graphql-system"))
 * - __importStar(require("@/graphql-system"))
 */
const isRequireOfRuntimeModule = (expr: ts.Expression | undefined, runtimeModule: string, typescript: typeof tsType): boolean => {
  if (!expr) {
    return false;
  }

  // Direct require("@/graphql-system")
  if (typescript.isCallExpression(expr)) {
    if (typescript.isIdentifier(expr.expression) && expr.expression.text === "require") {
      const arg = expr.arguments[0];
      if (arg && typescript.isStringLiteral(arg) && arg.text === runtimeModule) {
        return true;
      }
    }

    // __importDefault(require("@/graphql-system")) or __importStar(require("@/graphql-system"))
    if (typescript.isIdentifier(expr.expression)) {
      const helperName = expr.expression.text;
      if (helperName === "__importDefault" || helperName === "__importStar") {
        const arg = expr.arguments[0];
        if (arg && typescript.isCallExpression(arg)) {
          if (typescript.isIdentifier(arg.expression) && arg.expression.text === "require") {
            const requireArg = arg.arguments[0];
            if (requireArg && typescript.isStringLiteral(requireArg) && requireArg.text === runtimeModule) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
};
