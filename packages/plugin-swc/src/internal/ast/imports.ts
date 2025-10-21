import type { GraphqlSystemIdentifyHelper } from "@soda-gql/builder";
import type { CallExpression, ExpressionStatement, ImportDeclaration, ModuleItem, Span, VariableDeclaration } from "@swc/types";

const RUNTIME_MODULE = "@soda-gql/runtime";

/**
 * Helper to create placeholder span.
 */
const makeSpan = (): Span => ({
  start: 0,
  end: 0,
  ctxt: 0,
});

/**
 * Ensure that the gqlRuntime require exists in the module for CJS output.
 * Injects: const __soda_gql_runtime = require("@soda-gql/runtime");
 */
export const ensureGqlRuntimeRequire = (body: ModuleItem[]): ModuleItem[] => {
  // Check if the require already exists
  const existing = body.find((item): item is VariableDeclaration => {
    if (item.type !== "VariableDeclaration") {
      return false;
    }

    return item.declarations.some((decl) => {
      if (decl.id.type !== "Identifier" || decl.id.value !== "__soda_gql_runtime") {
        return false;
      }
      if (!decl.init || decl.init.type !== "CallExpression") {
        return false;
      }
      const callExpr = decl.init;
      if (callExpr.callee.type !== "Identifier" || callExpr.callee.value !== "require") {
        return false;
      }
      const arg = callExpr.arguments[0];
      return arg && arg.expression.type === "StringLiteral" && arg.expression.value === RUNTIME_MODULE;
    });
  });

  if (existing) {
    return body;
  }

  // Create: const __soda_gql_runtime = require("@soda-gql/runtime");
  const requireCall: CallExpression = {
    type: "CallExpression",
    span: makeSpan(),
    callee: {
      type: "Identifier",
      span: makeSpan(),
      value: "require",
      optional: false,
    },
    arguments: [
      {
        spread: undefined,
        expression: {
          type: "StringLiteral",
          span: makeSpan(),
          value: RUNTIME_MODULE,
        },
      },
    ],
  };

  const variableDeclaration: VariableDeclaration = {
    type: "VariableDeclaration",
    span: makeSpan(),
    kind: "const",
    declare: false,
    declarations: [
      {
        type: "VariableDeclarator",
        span: makeSpan(),
        id: {
          type: "Identifier",
          span: makeSpan(),
          value: "__soda_gql_runtime",
          optional: false,
        },
        init: requireCall,
        definite: false,
      },
    ],
  };

  // Insert at the beginning of the file
  return [variableDeclaration, ...body];
};

/**
 * Ensure that the gqlRuntime import exists in the module.
 * gqlRuntime is always imported from @soda-gql/runtime.
 */
export const ensureGqlRuntimeImport = (body: ModuleItem[]): ModuleItem[] => {
  const existing = body.find(
    (item): item is ImportDeclaration =>
      item.type === "ImportDeclaration" && item.source.type === "StringLiteral" && item.source.value === RUNTIME_MODULE,
  );

  if (existing) {
    const hasSpecifier = existing.specifiers.some(
      (spec) => spec.type === "ImportSpecifier" && spec.local.type === "Identifier" && spec.local.value === "gqlRuntime",
    );

    if (hasSpecifier) {
      return body;
    }

    // Add gqlRuntime to existing import
    existing.specifiers = [
      ...existing.specifiers,
      {
        type: "ImportSpecifier",
        span: makeSpan(),
        local: {
          type: "Identifier",
          span: makeSpan(),
          value: "gqlRuntime",
          optional: false,
        },
        imported: undefined,
        isTypeOnly: false,
      },
    ];

    return body;
  }

  // Create new import declaration
  const newImport: ImportDeclaration = {
    type: "ImportDeclaration",
    span: makeSpan(),
    specifiers: [
      {
        type: "ImportSpecifier",
        span: makeSpan(),
        local: {
          type: "Identifier",
          span: makeSpan(),
          value: "gqlRuntime",
          optional: false,
        },
        imported: undefined,
        isTypeOnly: false,
      },
    ],
    source: {
      type: "StringLiteral",
      span: makeSpan(),
      value: RUNTIME_MODULE,
    },
    typeOnly: false,
  };

  // Insert at the beginning
  return [newImport, ...body];
};

/**
 * Remove the graphql-system import (runtimeModule) and gql-related exports from the module.
 * After transformation, gqlRuntime is imported from @soda-gql/runtime instead,
 * so the original graphql-system import should be completely removed.
 *
 * This handles both ESM imports and CommonJS require() statements.
 */
export const removeGraphqlSystemImports = (
  body: ModuleItem[],
  graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper,
  filename: string,
): ModuleItem[] => {
  return body.filter((item) => {
    // Remove ESM import declarations for the graphql-system
    if (item.type === "ImportDeclaration" && item.source.type === "StringLiteral") {
      const isGraphqlSystem = graphqlSystemIdentifyHelper.isGraphqlSystemImportSpecifier({
        filePath: filename,
        specifier: item.source.value,
      });
      return !isGraphqlSystem;
    }

    // Remove CommonJS require() statements for the graphql-system
    if (item.type === "VariableDeclaration") {
      const shouldRemove = item.declarations.every((decl) => {
        const specifier = extractRequireTargetSpecifier(decl.init);
        if (!specifier) {
          return false;
        }

        return graphqlSystemIdentifyHelper.isGraphqlSystemImportSpecifier({
          filePath: filename,
          specifier: specifier,
        });
      });

      return !shouldRemove;
    }

    return true;
  });
};

/**
 * Create expression statements that stub out require() calls for the graphql-system.
 * This prevents the heavy graphql-system module from being loaded at runtime.
 */
export const createStubRequireStatements = (
  body: ModuleItem[],
  graphqlSystemIdentifyHelper: GraphqlSystemIdentifyHelper,
  filename: string,
): ExpressionStatement[] => {
  const stubs: ExpressionStatement[] = [];

  for (const item of body) {
    if (item.type === "VariableDeclaration") {
      for (const decl of item.declarations) {
        const specifier = extractRequireTargetSpecifier(decl.init);
        if (!specifier) {
          continue;
        }

        const isGraphqlSystem = graphqlSystemIdentifyHelper.isGraphqlSystemImportSpecifier({
          filePath: filename,
          specifier: specifier,
        });

        if (isGraphqlSystem && decl.id.type === "Identifier") {
          // Create stub: const X = /*#__PURE__*/Object.create(null);
          const stub: CallExpression = {
            type: "CallExpression",
            span: makeSpan(),
            callee: {
              type: "MemberExpression",
              span: makeSpan(),
              object: {
                type: "Identifier",
                span: makeSpan(),
                value: "Object",
                optional: false,
              },
              property: {
                type: "Identifier",
                span: makeSpan(),
                value: "create",
                optional: false,
              },
            },
            arguments: [
              {
                spread: undefined,
                expression: {
                  type: "NullLiteral",
                  span: makeSpan(),
                },
              },
            ],
          };

          stubs.push({
            type: "ExpressionStatement",
            span: makeSpan(),
            expression: stub,
          });
        }
      }
    }
  }

  return stubs;
};

/**
 * Check if an expression is a require() call and extract its target specifier.
 * Handles multiple patterns:
 * - require("@/graphql-system")
 * - interop helpers wrapping require()
 */
const extractRequireTargetSpecifier = (
  // biome-ignore lint/suspicious/noExplicitAny: SWC types are complex
  expr: any,
): string | undefined => {
  if (!expr) {
    return undefined;
  }

  // Direct require("@/graphql-system")
  if (expr.type === "CallExpression") {
    if (expr.callee.type === "Identifier" && expr.callee.value === "require") {
      const arg = expr.arguments[0];
      if (arg?.expression?.type === "StringLiteral") {
        return arg.expression.value;
      }
    }

    // Interop helper wrapping require()
    if (expr.callee.type === "Identifier" && (expr.callee.value === "Object" || expr.callee.value.startsWith("__import"))) {
      const arg = expr.arguments[0];
      if (arg?.expression?.type === "CallExpression") {
        const innerCall = arg.expression;
        if (innerCall.callee.type === "Identifier" && innerCall.callee.value === "require") {
          const requireArg = innerCall.arguments[0];
          if (requireArg?.expression?.type === "StringLiteral") {
            return requireArg.expression.value;
          }
        }
      }
    }
  }

  return undefined;
};
