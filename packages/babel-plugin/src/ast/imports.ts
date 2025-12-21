import { types as t } from "@babel/core";
import type { NodePath } from "@babel/traverse";
import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";

const RUNTIME_MODULE = "@soda-gql/runtime";

/**
 * Ensure that the gqlRuntime require exists in the program for CJS output.
 * Injects: const __soda_gql_runtime = require("@soda-gql/runtime");
 */
export const ensureGqlRuntimeRequire = (programPath: NodePath<t.Program>) => {
  // Check if the require already exists
  const existing = programPath.node.body.find(
    (statement): statement is t.VariableDeclaration =>
      t.isVariableDeclaration(statement) &&
      statement.declarations.some((decl) => {
        if (!t.isIdentifier(decl.id) || decl.id.name !== "__soda_gql_runtime") {
          return false;
        }
        if (!decl.init || !t.isCallExpression(decl.init)) {
          return false;
        }
        const callExpr = decl.init;
        if (!t.isIdentifier(callExpr.callee) || callExpr.callee.name !== "require") {
          return false;
        }
        const arg = callExpr.arguments[0];
        return arg && t.isStringLiteral(arg) && arg.value === RUNTIME_MODULE;
      }),
  );

  if (existing) {
    return;
  }

  // Create: const __soda_gql_runtime = require("@soda-gql/runtime");
  const requireCall = t.callExpression(t.identifier("require"), [t.stringLiteral(RUNTIME_MODULE)]);

  const variableDeclaration = t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier("__soda_gql_runtime"), requireCall),
  ]);

  // Insert at the beginning of the file
  programPath.node.body.unshift(variableDeclaration);
};

/**
 * Ensure that the gqlRuntime import exists in the program.
 * gqlRuntime is always imported from @soda-gql/runtime.
 */
export const ensureGqlRuntimeImport = (programPath: NodePath<t.Program>) => {
  const existing = programPath.node.body.find(
    (statement) => statement.type === "ImportDeclaration" && statement.source.value === RUNTIME_MODULE,
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
      t.stringLiteral(RUNTIME_MODULE),
    ),
  );
};

/**
 * Remove the graphql-system import (runtimeModule) and gql-related exports from the program.
 * After transformation, gqlRuntime is imported from @soda-gql/runtime instead,
 * so the original graphql-system import should be completely removed.
 *
 * This handles both ESM imports and CommonJS require() statements.
 */
export const removeGraphqlSystemImports = (
  programPath: NodePath<t.Program>,
  graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper,
  filename: string,
) => {
  // After transformation, all gql usage should be replaced with gqlRuntime
  // So we can safely remove the graphql-system import
  const toRemove: NodePath[] = [];

  programPath.traverse({
    // Remove ESM import declarations for the graphql-system
    ImportDeclaration(path) {
      if (t.isStringLiteral(path.node.source)) {
        const isGraphqlSystem = graphqlSystemIdentifyHelper.isGraphqlSystemImportSpecifier({
          filePath: filename,
          specifier: path.node.source.value,
        });
        if (isGraphqlSystem) {
          toRemove.push(path);
        }
      }
    },
    // Remove CommonJS require() statements for the graphql-system
    // - const graphql_system_1 = require("../../graphql-system");
    // - const { gql } = require("@/graphql-system");
    VariableDeclaration(path) {
      const shouldRemove = path.node.declarations.every((decl) => {
        const specifier = extractRequireTargetSpecifier(decl.init);
        if (!specifier) {
          return false;
        }

        return graphqlSystemIdentifyHelper.isGraphqlSystemImportSpecifier({
          filePath: filename,
          specifier: specifier,
        });
      });

      if (shouldRemove) {
        toRemove.push(path);
      }
    },
  });

  for (const path of toRemove) {
    path.remove();
  }
};

/**
 * Check if an expression is a require() call and extract its target specifier.
 * Handles multiple patterns:
 * - require("@/graphql-system")
 * - Object(require("@/graphql-system")) (interop helper pattern)
 */
const extractRequireTargetSpecifier = (expr: t.Node | null | undefined): string | undefined => {
  if (!expr) {
    return undefined;
  }

  // Direct require("@/graphql-system")
  if (t.isCallExpression(expr)) {
    if (t.isIdentifier(expr.callee) && expr.callee.name === "require") {
      const arg = expr.arguments[0];
      if (arg && t.isStringLiteral(arg)) {
        return arg.value;
      }
    }

    // Object(require("@/graphql-system")) or similar interop helpers
    if (t.isIdentifier(expr.callee) && (expr.callee.name === "Object" || expr.callee.name.startsWith("__import"))) {
      const arg = expr.arguments[0];
      if (arg && t.isCallExpression(arg)) {
        if (t.isIdentifier(arg.callee) && arg.callee.name === "require") {
          const requireArg = arg.arguments[0];
          if (requireArg && t.isStringLiteral(requireArg)) {
            return requireArg.value;
          }
        }
      }
    }
  }

  return undefined;
};
