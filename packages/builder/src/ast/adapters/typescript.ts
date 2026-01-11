/**
 * TypeScript adapter for the analyzer core.
 * Implements parser-specific logic using the TypeScript compiler API.
 */

import { extname } from "node:path";
import { createCanonicalId, createCanonicalTracker, type ScopeHandle } from "@soda-gql/common";
import ts from "typescript";
import type { GraphqlSystemIdentifyHelper } from "../../internal/graphql-system";
import { createStandardDiagnostic } from "../common/detection";
import { createExportBindingsMap, type ScopeFrame } from "../common/scope";
import type { AnalyzerAdapter, AnalyzerResult } from "../core";
import type {
  AnalyzeModuleInput,
  DiagnosticLocation,
  ModuleDefinition,
  ModuleDiagnostic,
  ModuleExport,
  ModuleImport,
} from "../types";

const createSourceFile = (filePath: string, source: string): ts.SourceFile => {
  const scriptKind = extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, scriptKind);
};

const collectGqlImports = (sourceFile: ts.SourceFile, helper: GraphqlSystemIdentifyHelper): ReadonlySet<string> => {
  const identifiers = new Set<string>();

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      return;
    }

    const moduleText = (statement.moduleSpecifier as ts.StringLiteral).text;
    if (!helper.isGraphqlSystemImportSpecifier({ filePath: sourceFile.fileName, specifier: moduleText })) {
      return;
    }

    if (statement.importClause.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
      statement.importClause.namedBindings.elements.forEach((element) => {
        const imported = element.propertyName ? element.propertyName.text : element.name.text;
        // Only add non-renamed imports (propertyName exists when renamed: "gql as g")
        if (imported === "gql" && !element.propertyName) {
          identifiers.add(element.name.text);
        }
      });
    }
  });

  return identifiers;
};

const collectImports = (sourceFile: ts.SourceFile): ModuleImport[] => {
  const imports: ModuleImport[] = [];

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      return;
    }

    const moduleText = (statement.moduleSpecifier as ts.StringLiteral).text;
    const { importClause } = statement;

    if (importClause.name) {
      imports.push({
        source: moduleText,
        local: importClause.name.text,
        kind: "default",
        isTypeOnly: Boolean(importClause.isTypeOnly),
      });
    }

    const { namedBindings } = importClause;
    if (!namedBindings) {
      return;
    }

    if (ts.isNamespaceImport(namedBindings)) {
      imports.push({
        source: moduleText,
        local: namedBindings.name.text,
        kind: "namespace",
        isTypeOnly: Boolean(importClause.isTypeOnly),
      });
      return;
    }

    namedBindings.elements.forEach((element) => {
      imports.push({
        source: moduleText,
        local: element.name.text,
        kind: "named",
        isTypeOnly: Boolean(importClause.isTypeOnly || element.isTypeOnly),
      });
    });
  });

  return imports;
};

const collectExports = (sourceFile: ts.SourceFile): ModuleExport[] => {
  const exports: ModuleExport[] = [];

  sourceFile.statements.forEach((statement) => {
    if (ts.isExportDeclaration(statement)) {
      const moduleSpecifier = statement.moduleSpecifier ? (statement.moduleSpecifier as ts.StringLiteral).text : undefined;

      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        statement.exportClause.elements.forEach((element) => {
          if (moduleSpecifier) {
            exports.push({
              kind: "reexport",
              exported: element.name.text,
              local: element.propertyName ? element.propertyName.text : undefined,
              source: moduleSpecifier,
              isTypeOnly: Boolean(statement.isTypeOnly || element.isTypeOnly),
            });
          } else {
            exports.push({
              kind: "named",
              exported: element.name.text,
              local: element.propertyName ? element.propertyName.text : element.name.text,
              isTypeOnly: Boolean(statement.isTypeOnly || element.isTypeOnly),
            });
          }
        });
        return;
      }

      if (moduleSpecifier) {
        exports.push({
          kind: "reexport",
          exported: "*",
          source: moduleSpecifier,
          isTypeOnly: Boolean(statement.isTypeOnly),
        });
      }

      return;
    }

    if (ts.isExportAssignment(statement)) {
      exports.push({
        kind: "named",
        exported: "default",
        local: "default",
        isTypeOnly: false,
      });
    }

    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      statement.declarationList.declarations.forEach((declaration) => {
        if (ts.isIdentifier(declaration.name)) {
          exports.push({
            kind: "named",
            exported: declaration.name.text,
            local: declaration.name.text,
            isTypeOnly: false,
          });
        }
      });
    }

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
      statement.name
    ) {
      exports.push({
        kind: "named",
        exported: statement.name.text,
        local: statement.name.text,
        isTypeOnly: false,
      });
    }
  });

  return exports;
};

/**
 * Unwrap NonNullExpression nodes to get the underlying expression.
 * Handles cases like `gql!` or `gql!!` by recursively unwrapping.
 */
const unwrapNonNullExpression = (node: ts.Expression): ts.Expression => {
  if (ts.isNonNullExpression(node)) {
    return unwrapNonNullExpression(node.expression);
  }
  return node;
};

const isGqlDefinitionCall = (identifiers: ReadonlySet<string>, callExpression: ts.CallExpression): boolean => {
  const expression = callExpression.expression;
  if (!ts.isPropertyAccessExpression(expression)) {
    return false;
  }

  // Unwrap NonNullExpression: gql!.default(...) -> gql.default(...)
  const baseExpr = unwrapNonNullExpression(expression.expression);

  if (!ts.isIdentifier(baseExpr) || !identifiers.has(baseExpr.text)) {
    return false;
  }

  const [factory] = callExpression.arguments;
  if (!factory || !ts.isArrowFunction(factory)) {
    return false;
  }

  return true;
};

/**
 * Unwrap method chains (like .attach()) to find the underlying gql call.
 * Returns the innermost CallExpression that is a valid gql definition call.
 */
const unwrapMethodChains = (identifiers: ReadonlySet<string>, node: ts.Node): ts.CallExpression | null => {
  if (!ts.isCallExpression(node)) {
    return null;
  }

  // Check if this is directly a gql definition call
  if (isGqlDefinitionCall(identifiers, node)) {
    return node;
  }

  // Check if this is a method call on another expression (e.g., .attach())
  const expression = node.expression;
  if (!ts.isPropertyAccessExpression(expression)) {
    return null;
  }

  // Recursively check the object of the property access
  // e.g., for `gql.default(...).attach(...)`, expression.expression is `gql.default(...)`
  return unwrapMethodChains(identifiers, expression.expression);
};

/**
 * Get property name from AST node
 */
const getPropertyName = (name: ts.PropertyName): string | null => {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
};

/**
 * Collect all gql definitions (exported, non-exported, top-level, nested)
 */
const collectAllDefinitions = ({
  sourceFile,
  identifiers,
  exports,
}: {
  sourceFile: ts.SourceFile;
  identifiers: ReadonlySet<string>;
  exports: readonly ModuleExport[];
}): {
  readonly definitions: ModuleDefinition[];
  readonly handledCalls: readonly ts.CallExpression[];
} => {
  type PendingDefinition = {
    readonly astPath: string;
    readonly isTopLevel: boolean;
    readonly isExported: boolean;
    readonly exportBinding?: string;
    readonly expression: string;
  };

  const pending: PendingDefinition[] = [];
  const handledCalls: ts.CallExpression[] = [];

  // Build export bindings map (which variables are exported and with what name)
  const exportBindings = createExportBindingsMap(exports);

  // Create canonical tracker
  const tracker = createCanonicalTracker({
    filePath: sourceFile.fileName,
    getExportName: (localName) => exportBindings.get(localName),
  });

  // Anonymous scope counters (for naming only, not occurrence tracking)
  // Use underscore separator instead of # to ensure valid JavaScript identifiers
  const anonymousCounters = new Map<string, number>();
  const getAnonymousName = (kind: string): string => {
    const count = anonymousCounters.get(kind) ?? 0;
    anonymousCounters.set(kind, count + 1);
    return `_${kind}_${count}`;
  };

  // Helper to synchronize tracker with immutable stack pattern
  const withScope = <T>(
    stack: ScopeFrame[],
    segment: string,
    kind: ScopeFrame["kind"],
    stableKey: string,
    callback: (newStack: ScopeFrame[]) => T,
  ): T => {
    const handle = tracker.enterScope({ segment, kind, stableKey });
    try {
      const frame: ScopeFrame = { nameSegment: segment, kind };
      return callback([...stack, frame]);
    } finally {
      tracker.exitScope(handle);
    }
  };

  // Check if we're inside a class property (class property scope tracking is unreliable)
  const isInClassProperty = (stack: ScopeFrame[]): boolean =>
    stack.some((frame, i) => frame.kind === "property" && stack[i - 1]?.kind === "class");

  const visit = (node: ts.Node, stack: ScopeFrame[]) => {
    // Check if this is a gql definition call (possibly wrapped in method chains like .attach())
    if (ts.isCallExpression(node)) {
      const gqlCall = unwrapMethodChains(identifiers, node);
      // Skip definition collection for gql calls inside class properties
      // (CLASS_PROPERTY diagnostic is still emitted by collectClassPropertyDiagnostics)
      if (gqlCall && !isInClassProperty(stack)) {
        // If scopeStack is empty (unbound gql call), enter an anonymous scope
        const needsAnonymousScope = tracker.currentDepth() === 0;
        let anonymousScopeHandle: ScopeHandle | undefined;

        if (needsAnonymousScope) {
          const anonymousName = getAnonymousName("anonymous");
          anonymousScopeHandle = tracker.enterScope({
            segment: anonymousName,
            kind: "expression",
            stableKey: "anonymous",
          });
        }

        try {
          // Use tracker to get astPath
          const { astPath } = tracker.registerDefinition();
          const isTopLevel = stack.length === 1;

          // Determine if exported
          let isExported = false;
          let exportBinding: string | undefined;

          if (isTopLevel && stack[0]) {
            const topLevelName = stack[0].nameSegment;
            if (exportBindings.has(topLevelName)) {
              isExported = true;
              exportBinding = exportBindings.get(topLevelName);
            }
          }

          handledCalls.push(node);
          pending.push({
            astPath,
            isTopLevel,
            isExported,
            exportBinding,
            // Use the unwrapped gql call expression (without .attach() chain)
            expression: gqlCall.getText(sourceFile),
          });
        } finally {
          // Exit anonymous scope if we entered one
          if (anonymousScopeHandle) {
            tracker.exitScope(anonymousScopeHandle);
          }
        }

        // Don't visit children of gql calls
        return;
      }
    }

    // Variable declaration
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const varName = node.name.text;

      if (node.initializer) {
        const next = node.initializer;
        withScope(stack, varName, "variable", `var:${varName}`, (newStack) => {
          visit(next, newStack);
        });
      }
      return;
    }

    // Function declaration
    if (ts.isFunctionDeclaration(node)) {
      const funcName = node.name?.text ?? getAnonymousName("function");

      if (node.body) {
        const next = node.body;
        withScope(stack, funcName, "function", `func:${funcName}`, (newStack) => {
          ts.forEachChild(next, (child) => visit(child, newStack));
        });
      }
      return;
    }

    // Arrow function
    if (ts.isArrowFunction(node)) {
      const arrowName = getAnonymousName("arrow");

      withScope(stack, arrowName, "function", "arrow", (newStack) => {
        if (ts.isBlock(node.body)) {
          ts.forEachChild(node.body, (child) => visit(child, newStack));
        } else {
          visit(node.body, newStack);
        }
      });
      return;
    }

    // Function expression
    if (ts.isFunctionExpression(node)) {
      const funcName = node.name?.text ?? getAnonymousName("function");

      if (node.body) {
        withScope(stack, funcName, "function", `func:${funcName}`, (newStack) => {
          ts.forEachChild(node.body, (child) => visit(child, newStack));
        });
      }
      return;
    }

    // Class declaration
    if (ts.isClassDeclaration(node)) {
      const className = node.name?.text ?? getAnonymousName("class");

      withScope(stack, className, "class", `class:${className}`, (classStack) => {
        node.members.forEach((member) => {
          if (ts.isMethodDeclaration(member) || ts.isPropertyDeclaration(member)) {
            const memberName = member.name && ts.isIdentifier(member.name) ? member.name.text : null;
            if (memberName) {
              const memberKind = ts.isMethodDeclaration(member) ? "method" : "property";
              withScope(classStack, memberName, memberKind, `member:${className}.${memberName}`, (memberStack) => {
                if (ts.isMethodDeclaration(member) && member.body) {
                  ts.forEachChild(member.body, (child) => visit(child, memberStack));
                } else if (ts.isPropertyDeclaration(member) && member.initializer) {
                  visit(member.initializer, memberStack);
                }
              });
            }
          }
        });
      });
      return;
    }

    // Object literal property
    if (ts.isPropertyAssignment(node)) {
      const propName = getPropertyName(node.name);
      if (propName) {
        withScope(stack, propName, "property", `prop:${propName}`, (newStack) => {
          visit(node.initializer, newStack);
        });
      }
      return;
    }

    // Recursively visit children
    ts.forEachChild(node, (child) => visit(child, stack));
  };

  // Start traversal from top-level statements
  sourceFile.statements.forEach((statement) => {
    visit(statement, []);
  });

  const definitions = pending.map(
    (item) =>
      ({
        canonicalId: createCanonicalId(sourceFile.fileName, item.astPath),
        astPath: item.astPath,
        isTopLevel: item.isTopLevel,
        isExported: item.isExported,
        exportBinding: item.exportBinding,
        expression: item.expression,
      }) satisfies ModuleDefinition,
  );

  return { definitions, handledCalls };
};

// ============================================================================
// Diagnostic Collection
// ============================================================================

/**
 * Get location from a TypeScript node
 */
const getLocation = (sourceFile: ts.SourceFile, node: ts.Node): DiagnosticLocation => {
  const start = node.getStart(sourceFile);
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
  return {
    start,
    end: node.getEnd(),
    line: line + 1, // 1-indexed
    column: character + 1,
  };
};

/**
 * Collect diagnostics for invalid import patterns from graphql-system
 */
const collectImportDiagnostics = (sourceFile: ts.SourceFile, helper: GraphqlSystemIdentifyHelper): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      return;
    }

    const moduleText = (statement.moduleSpecifier as ts.StringLiteral).text;
    if (!helper.isGraphqlSystemImportSpecifier({ filePath: sourceFile.fileName, specifier: moduleText })) {
      return;
    }

    const { importClause } = statement;

    // Check for default import: import gql from "..."
    if (importClause.name) {
      diagnostics.push(createStandardDiagnostic("DEFAULT_IMPORT", getLocation(sourceFile, importClause.name), undefined));
    }

    const { namedBindings } = importClause;
    if (!namedBindings) {
      return;
    }

    // Check for namespace import: import * as gqlSystem from "..."
    if (ts.isNamespaceImport(namedBindings)) {
      diagnostics.push(
        createStandardDiagnostic("STAR_IMPORT", getLocation(sourceFile, namedBindings), {
          namespaceAlias: namedBindings.name.text,
        }),
      );
      return;
    }

    // Check for renamed gql import: import { gql as g } from "..."
    namedBindings.elements.forEach((element) => {
      const imported = element.propertyName ? element.propertyName.text : element.name.text;
      // Only report if gql is renamed (propertyName exists and is "gql")
      if (imported === "gql" && element.propertyName) {
        diagnostics.push(
          createStandardDiagnostic("RENAMED_IMPORT", getLocation(sourceFile, element), {
            importedAs: element.name.text,
          }),
        );
      }
    });
  });

  return diagnostics;
};

/**
 * Check if a node contains a reference to any gql identifier
 */
const containsGqlIdentifier = (node: ts.Node, identifiers: ReadonlySet<string>): boolean => {
  if (ts.isIdentifier(node) && identifiers.has(node.text)) {
    return true;
  }
  let found = false;
  ts.forEachChild(node, (child) => {
    if (containsGqlIdentifier(child, identifiers)) {
      found = true;
    }
  });
  return found;
};

/**
 * Get the type name of an argument for error messages
 */
const getArgumentType = (node: ts.Node): string => {
  if (ts.isStringLiteral(node)) return "string";
  if (ts.isNumericLiteral(node)) return "number";
  if (ts.isObjectLiteralExpression(node)) return "object";
  if (ts.isArrayLiteralExpression(node)) return "array";
  if (ts.isFunctionExpression(node)) return "function";
  if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) return "undefined";
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return "boolean";
  return "unknown";
};

/**
 * Collect diagnostics for invalid gql call patterns
 */
const collectCallDiagnostics = (sourceFile: ts.SourceFile, gqlIdentifiers: ReadonlySet<string>): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const diagnostic = checkCallExpression(sourceFile, node, gqlIdentifiers);
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
    ts.forEachChild(node, visit);
  };

  sourceFile.statements.forEach(visit);
  return diagnostics;
};

/**
 * Check a call expression for invalid gql patterns
 */
const checkCallExpression = (
  sourceFile: ts.SourceFile,
  call: ts.CallExpression,
  gqlIdentifiers: ReadonlySet<string>,
): ModuleDiagnostic | null => {
  const { expression } = call;

  // Check for direct gql() call (non-member): gql(...)
  if (ts.isIdentifier(expression) && gqlIdentifiers.has(expression.text)) {
    return createStandardDiagnostic("NON_MEMBER_CALLEE", getLocation(sourceFile, call), undefined);
  }

  // Check for element access: gql["default"](...) or gql!["default"](...)
  if (ts.isElementAccessExpression(expression)) {
    const baseExpr = unwrapNonNullExpression(expression.expression);
    if (ts.isIdentifier(baseExpr) && gqlIdentifiers.has(baseExpr.text)) {
      return createStandardDiagnostic("COMPUTED_PROPERTY", getLocation(sourceFile, call), undefined);
    }
    return null;
  }

  // Must be property access for valid gql call
  if (!ts.isPropertyAccessExpression(expression)) {
    return null;
  }

  // Unwrap NonNullExpression: gql!.default(...) -> gql.default(...)
  const baseExpr = unwrapNonNullExpression(expression.expression);

  // Check for optional chaining: gql?.default(...)
  if (expression.questionDotToken) {
    if (ts.isIdentifier(baseExpr) && gqlIdentifiers.has(baseExpr.text)) {
      return createStandardDiagnostic("OPTIONAL_CHAINING", getLocation(sourceFile, call), undefined);
    }
    return null;
  }

  // Check for dynamic callee: (x || gql).default(...)
  if (!ts.isIdentifier(baseExpr)) {
    if (containsGqlIdentifier(expression.expression, gqlIdentifiers)) {
      return createStandardDiagnostic("DYNAMIC_CALLEE", getLocation(sourceFile, call), undefined);
    }
    return null;
  }

  // Not a gql identifier - skip
  if (!gqlIdentifiers.has(baseExpr.text)) {
    return null;
  }

  // Check arguments for gql.schema(...) calls
  if (call.arguments.length === 0) {
    return createStandardDiagnostic("MISSING_ARGUMENT", getLocation(sourceFile, call), undefined);
  }

  const firstArg = call.arguments[0];

  // Check for spread argument: gql.default(...args)
  if (firstArg && ts.isSpreadElement(firstArg)) {
    return createStandardDiagnostic("SPREAD_ARGUMENT", getLocation(sourceFile, call), undefined);
  }

  if (firstArg && !ts.isArrowFunction(firstArg)) {
    const actualType = getArgumentType(firstArg);
    return createStandardDiagnostic("INVALID_ARGUMENT_TYPE", getLocation(sourceFile, call), { actualType });
  }

  // Check for extra arguments: gql.default(() => ..., extra)
  if (call.arguments.length > 1) {
    const extraCount = call.arguments.length - 1;
    return createStandardDiagnostic("EXTRA_ARGUMENTS", getLocation(sourceFile, call), {
      extraCount: String(extraCount),
    });
  }

  return null;
};

/**
 * Collect diagnostics for gql calls in class properties
 */
const collectClassPropertyDiagnostics = (sourceFile: ts.SourceFile, gqlIdentifiers: ReadonlySet<string>): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];

  const containsGqlCall = (node: ts.Node): boolean => {
    if (ts.isCallExpression(node) && isGqlDefinitionCall(gqlIdentifiers, node)) {
      return true;
    }
    let found = false;
    ts.forEachChild(node, (child) => {
      if (containsGqlCall(child)) {
        found = true;
      }
    });
    return found;
  };

  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node)) {
      node.members.forEach((member) => {
        if (ts.isPropertyDeclaration(member) && member.initializer) {
          if (containsGqlCall(member.initializer)) {
            diagnostics.push(createStandardDiagnostic("CLASS_PROPERTY", getLocation(sourceFile, member), undefined));
          }
        }
      });
    }
    ts.forEachChild(node, visit);
  };

  sourceFile.statements.forEach(visit);
  return diagnostics;
};

/**
 * TypeScript adapter implementation.
 * The analyze method parses and collects all data in one pass,
 * ensuring the AST (ts.SourceFile) is released after analysis.
 */
export const typescriptAdapter: AnalyzerAdapter = {
  analyze(input: AnalyzeModuleInput, helper: GraphqlSystemIdentifyHelper): AnalyzerResult | null {
    // Parse source - AST is local to this function
    const sourceFile = createSourceFile(input.filePath, input.source);

    // Collect all data in one pass
    const gqlIdentifiers = collectGqlImports(sourceFile, helper);
    const imports = collectImports(sourceFile);
    const exports = collectExports(sourceFile);

    const { definitions } = collectAllDefinitions({
      sourceFile,
      identifiers: gqlIdentifiers,
      exports,
    });

    // Collect diagnostics
    const diagnostics = [
      ...collectImportDiagnostics(sourceFile, helper),
      ...collectCallDiagnostics(sourceFile, gqlIdentifiers),
      ...collectClassPropertyDiagnostics(sourceFile, gqlIdentifiers),
    ];

    // Return results - sourceFile goes out of scope and becomes eligible for GC
    return {
      imports,
      exports,
      definitions,
      diagnostics,
    };
  },
};
