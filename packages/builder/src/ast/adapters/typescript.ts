/**
 * TypeScript adapter for the analyzer core.
 * Implements parser-specific logic using the TypeScript compiler API.
 */

import { extname } from "node:path";
import ts from "typescript";
import { createCanonicalTracker } from "../../canonical-id/path-tracker";
import { createExportBindingsMap, type ScopeFrame } from "../common/scope";
import type { AnalyzerAdapter } from "../core";
import type {
  AnalyzeModuleInput,
  ModuleDefinition,
  ModuleDiagnostic,
  ModuleExport,
  ModuleImport,
  SourceLocation,
} from "../types";

const createSourceFile = (filePath: string, source: string): ts.SourceFile => {
  const scriptKind = extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, scriptKind);
};

const toLocation = (sourceFile: ts.SourceFile, node: ts.Node): SourceLocation => {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  return {
    start: { line: start.line + 1, column: start.character + 1 },
    end: { line: end.line + 1, column: end.character + 1 },
  } satisfies SourceLocation;
};

const collectGqlImports = (sourceFile: ts.SourceFile): ReadonlySet<string> => {
  const identifiers = new Set<string>();

  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      return;
    }

    const moduleText = (statement.moduleSpecifier as ts.StringLiteral).text;
    if (!moduleText.endsWith("/graphql-system")) {
      return;
    }

    if (statement.importClause.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
      statement.importClause.namedBindings.elements.forEach((element) => {
        const imported = element.propertyName ? element.propertyName.text : element.name.text;
        if (imported === "gql") {
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
        imported: "default",
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
        imported: "*",
        local: namedBindings.name.text,
        kind: "namespace",
        isTypeOnly: Boolean(importClause.isTypeOnly),
      });
      return;
    }

    namedBindings.elements.forEach((element) => {
      imports.push({
        source: moduleText,
        imported: element.propertyName ? element.propertyName.text : element.name.text,
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

const isGqlDefinitionCall = (identifiers: ReadonlySet<string>, callExpression: ts.CallExpression): boolean => {
  const expression = callExpression.expression;
  if (!ts.isPropertyAccessExpression(expression)) {
    return false;
  }

  if (!ts.isIdentifier(expression.expression) || !identifiers.has(expression.expression.text)) {
    return false;
  }

  const [factory] = callExpression.arguments;
  if (!factory || !ts.isArrowFunction(factory)) {
    return false;
  }

  return true;
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
const collectAllDefinitions = (
  sourceFile: ts.SourceFile,
  identifiers: ReadonlySet<string>,
  exports: readonly ModuleExport[],
): {
  readonly definitions: ModuleDefinition[];
  readonly handledCalls: readonly ts.CallExpression[];
} => {
  type PendingDefinition = {
    readonly astPath: string;
    readonly exportName: string; // For backward compat
    readonly isTopLevel: boolean;
    readonly isExported: boolean;
    readonly exportBinding?: string;
    readonly loc: SourceLocation;
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
  const anonymousCounters = new Map<string, number>();
  const getAnonymousName = (kind: string): string => {
    const count = anonymousCounters.get(kind) ?? 0;
    anonymousCounters.set(kind, count + 1);
    return `${kind}#${count}`;
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

  const visit = (node: ts.Node, stack: ScopeFrame[]) => {
    // Check if this is a gql definition call
    if (ts.isCallExpression(node) && isGqlDefinitionCall(identifiers, node)) {
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
        exportName: astPath, // For backward compat
        isTopLevel,
        isExported,
        exportBinding,
        loc: toLocation(sourceFile, node),
        expression: node.getText(sourceFile),
      });

      // Don't visit children of gql calls
      return;
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
        exportName: item.exportName,
        astPath: item.astPath,
        isTopLevel: item.isTopLevel,
        isExported: item.isExported,
        exportBinding: item.exportBinding,
        loc: item.loc,
        expression: item.expression,
      }) satisfies ModuleDefinition,
  );

  return { definitions, handledCalls };
};

/**
 * Collect diagnostics (now empty since we support all definition types)
 */
const collectDiagnostics = (
  _sourceFile: ts.SourceFile,
  _identifiers: ReadonlySet<string>,
  _handledCalls: readonly ts.CallExpression[],
): ModuleDiagnostic[] => {
  // No longer emit NON_TOP_LEVEL_DEFINITION diagnostics
  // All gql definitions are now supported
  return [];
};

/**
 * TypeScript adapter implementation
 */
export const typescriptAdapter: AnalyzerAdapter<ts.SourceFile, ts.CallExpression> = {
  parse(input: AnalyzeModuleInput): ts.SourceFile | null {
    return createSourceFile(input.filePath, input.source);
  },

  collectGqlIdentifiers(file: ts.SourceFile): ReadonlySet<string> {
    return collectGqlImports(file);
  },

  collectImports(file: ts.SourceFile): readonly ModuleImport[] {
    return collectImports(file);
  },

  collectExports(file: ts.SourceFile): readonly ModuleExport[] {
    return collectExports(file);
  },

  collectDefinitions(
    file: ts.SourceFile,
    context: {
      readonly gqlIdentifiers: ReadonlySet<string>;
      readonly imports: readonly ModuleImport[];
      readonly exports: readonly ModuleExport[];
      readonly source: string;
    },
  ): {
    readonly definitions: readonly ModuleDefinition[];
    readonly handles: readonly ts.CallExpression[];
  } {
    const { definitions, handledCalls } = collectAllDefinitions(file, context.gqlIdentifiers, context.exports);
    return { definitions, handles: handledCalls };
  },

  collectDiagnostics(
    file: ts.SourceFile,
    context: {
      readonly gqlIdentifiers: ReadonlySet<string>;
      readonly handledCalls: readonly ts.CallExpression[];
      readonly source: string;
    },
  ): readonly ModuleDiagnostic[] {
    return collectDiagnostics(file, context.gqlIdentifiers, context.handledCalls);
  },
};
