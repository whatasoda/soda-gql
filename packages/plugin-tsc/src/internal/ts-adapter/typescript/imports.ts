import ts from "typescript";

export type GraphqlSystemIdentifyHelper = {
  readonly isGraphqlSystemFile: (input: { filePath: string }) => boolean;
  readonly isGraphqlSystemImportSpecifier: (input: { filePath: string; specifier: string }) => boolean;
};

const RUNTIME_MODULE = "@soda-gql/runtime";

/**
 * Ensure that the gqlRuntime require exists in the source file for CJS output.
 * Injects: const __soda_gql_runtime = require("@soda-gql/runtime");
 * Returns an updated source file with the require added if needed.
 */
export const ensureGqlRuntimeRequire = ({
  sourceFile,
  factory,
}: {
  sourceFile: ts.SourceFile;
  factory: ts.NodeFactory;
}): ts.SourceFile => {
  // Check if the require already exists
  const existing = sourceFile.statements.find(
    (statement): statement is ts.VariableStatement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some((decl) => {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== "__soda_gql_runtime") {
          return false;
        }
        if (!decl.initializer || !ts.isCallExpression(decl.initializer)) {
          return false;
        }
        const callExpr = decl.initializer;
        if (!ts.isIdentifier(callExpr.expression) || callExpr.expression.text !== "require") {
          return false;
        }
        const arg = callExpr.arguments[0];
        return arg && ts.isStringLiteral(arg) && arg.text === RUNTIME_MODULE;
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
    factory.createVariableDeclarationList([variableDeclaration], ts.NodeFlags.Const),
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
export const ensureGqlRuntimeImport = ({
  sourceFile,
  factory,
}: {
  sourceFile: ts.SourceFile;
  factory: ts.NodeFactory;
}): ts.SourceFile => {
  const existing = sourceFile.statements.find(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === RUNTIME_MODULE,
  );

  if (existing?.importClause?.namedBindings && ts.isNamedImports(existing.importClause.namedBindings)) {
    const hasSpecifier = existing.importClause.namedBindings.elements.some(
      (element) => ts.isIdentifier(element.name) && element.name.text === "gqlRuntime",
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
export const removeGraphqlSystemImports = ({
  sourceFile,
  factory,
  graphqlSystemIdentifyHelper,
}: {
  sourceFile: ts.SourceFile;
  factory: ts.NodeFactory;
  graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper;
}): ts.SourceFile => {
  // After transformation, all gql usage should be replaced with gqlRuntime
  // So we can safely remove the graphql-system import and all gql-related exports
  const updatedStatements = Array.from(sourceFile.statements).filter((statement) => {
    // Remove ESM import declarations for the runtimeModule
    // - import { gql } from "@/graphql-system";
    // - import * as gql from "@/graphql-system";
    // - import gql from "@/graphql-system";
    // - import { gql as gqlRuntime } from "@/graphql-system";
    // - import * as gqlRuntime from "@/graphql-system";
    // - import gqlRuntime from "@/graphql-system";
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      return !graphqlSystemIdentifyHelper.isGraphqlSystemImportSpecifier({
        filePath: sourceFile.fileName,
        specifier: statement.moduleSpecifier.text,
      });
    }

    // Remove CommonJS require() statements for the runtimeModule
    // TypeScript emits these when downleveling ESM to CJS:
    // - const graphql_system_1 = require("../../graphql-system");
    // - const { gql } = require("@/graphql-system");
    // - const foo = __importDefault(require("@/graphql-system"));
    // - const foo = __importStar(require("@/graphql-system"));
    if (ts.isVariableStatement(statement)) {
      return !statement.declarationList.declarations.every((decl) => {
        const specifier = extractRequireTargetSpecifier(decl.initializer);
        if (!specifier) {
          return false;
        }

        return graphqlSystemIdentifyHelper.isGraphqlSystemImportSpecifier({
          filePath: sourceFile.fileName,
          specifier: specifier,
        });
      });
    }

    return true;
  });

  if (updatedStatements.length === sourceFile.statements.length) {
    return sourceFile;
  }

  return factory.updateSourceFile(sourceFile, updatedStatements);
};

/**
 * Create an "after" transformer that stubs out require() calls for the runtimeModule.
 * This runs after TypeScript's own transformers (including CommonJS down-leveling),
 * so we can replace `const X = require("@/graphql-system")` with a lightweight stub.
 *
 * This prevents the heavy graphql-system module from being loaded at runtime.
 */
export const createAfterStubTransformer = ({
  sourceFile,
  graphqlSystemIdentifyHelper,
}: {
  sourceFile: ts.SourceFile;
  graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper;
}): ts.TransformerFactory<ts.SourceFile> => {
  return (context) => {
    const factory = context.factory;

    const visitor = (node: ts.Node): ts.Node => {
      // Replace variable statements that require the runtimeModule with a stub
      if (ts.isVariableStatement(node)) {
        let transformed = false;

        const newDeclarations = node.declarationList.declarations.map((decl) => {
          const specifier = extractRequireTargetSpecifier(decl.initializer);
          if (!specifier) {
            return decl;
          }

          const isGraphqlSystemImport = graphqlSystemIdentifyHelper.isGraphqlSystemImportSpecifier({
            filePath: sourceFile.fileName,
            specifier,
          });
          if (!isGraphqlSystemImport) {
            return decl;
          }

          // Create stub: const X = /*#__PURE__*/Object.create(null);
          const stub = factory.createCallExpression(
            factory.createPropertyAccessExpression(factory.createIdentifier("Object"), "create"),
            undefined,
            [factory.createNull()],
          );

          // Add /*#__PURE__*/ comment for tree-shaking
          ts.addSyntheticLeadingComment(stub, ts.SyntaxKind.MultiLineCommentTrivia, "#__PURE__", false);

          transformed = true;

          return factory.updateVariableDeclaration(decl, decl.name, decl.exclamationToken, decl.type, stub);
        });

        if (transformed) {
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
const extractRequireTargetSpecifier = (expr: ts.Expression | undefined): string | undefined => {
  if (!expr) {
    return undefined;
  }

  // Direct require("@/graphql-system")
  if (ts.isCallExpression(expr)) {
    if (ts.isIdentifier(expr.expression) && expr.expression.text === "require") {
      const arg = expr.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        return arg.text;
      }
    }

    // __importDefault(require("@/graphql-system")) or __importStar(require("@/graphql-system"))
    if (ts.isIdentifier(expr.expression)) {
      const helperName = expr.expression.text;
      if (helperName === "__importDefault" || helperName === "__importStar") {
        const arg = expr.arguments[0];
        if (arg && ts.isCallExpression(arg)) {
          if (ts.isIdentifier(arg.expression) && arg.expression.text === "require") {
            const requireArg = arg.arguments[0];
            if (requireArg && ts.isStringLiteral(requireArg)) {
              return requireArg.text;
            }
          }
        }
      }
    }
  }

  return undefined;
};
