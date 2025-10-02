/**
 * TypeScript adapter for the analyzer core.
 * Implements parser-specific logic using the TypeScript compiler API.
 */

import { extname } from "node:path";
import ts from "typescript";

import type { AnalyzerAdapter } from "../analyzer-core";
import { analyzeModuleCore } from "../analyzer-core";
import type {
  AnalyzeModuleInput,
  ModuleAnalysis,
  ModuleDefinition,
  ModuleDiagnostic,
  ModuleExport,
  ModuleImport,
  SourceLocation,
} from "../analyzer-types";

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
 * Scope frame for tracking AST path segments
 */
type ScopeFrame = {
  /** Name segment (e.g., "MyComponent", "useQuery", "arrow#1") */
  readonly nameSegment: string;
  /** Kind of scope */
  readonly kind: "function" | "class" | "variable" | "property" | "method" | "expression";
  /** Occurrence index for disambiguation */
  readonly occurrence: number;
};

/**
 * Build AST path from scope stack
 */
const buildAstPath = (stack: readonly ScopeFrame[]): string => {
  return stack.map((frame) => frame.nameSegment).join(".");
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
  const usedPaths = new Set<string>();

  // Build export bindings map (which variables are exported and with what name)
  const exportBindings = new Map<string, string>(); // local -> exported
  exports.forEach((exp) => {
    if (exp.kind === "named" && !exp.isTypeOnly) {
      exportBindings.set(exp.local, exp.exported);
    }
  });

  // Counter for anonymous scopes
  const occurrenceCounters = new Map<string, number>();

  const getNextOccurrence = (key: string): number => {
    const current = occurrenceCounters.get(key) ?? 0;
    occurrenceCounters.set(key, current + 1);
    return current;
  };

  const ensureUniquePath = (basePath: string): string => {
    let path = basePath;
    let suffix = 0;
    while (usedPaths.has(path)) {
      suffix++;
      path = `${basePath}$${suffix}`;
    }
    usedPaths.add(path);
    return path;
  };

  const visit = (node: ts.Node, stack: ScopeFrame[]) => {
    // Check if this is a gql definition call
    if (ts.isCallExpression(node) && isGqlDefinitionCall(identifiers, node)) {
      const astPath = ensureUniquePath(buildAstPath(stack));
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
      const newFrame: ScopeFrame = {
        nameSegment: varName,
        kind: "variable",
        occurrence: getNextOccurrence(`var:${varName}`),
      };

      if (node.initializer) {
        visit(node.initializer, [...stack, newFrame]);
      }
      return;
    }

    // Function declaration
    if (ts.isFunctionDeclaration(node)) {
      const funcName = node.name?.text ?? `function#${getNextOccurrence("function")}`;
      const newFrame: ScopeFrame = {
        nameSegment: funcName,
        kind: "function",
        occurrence: getNextOccurrence(`func:${funcName}`),
      };

      if (node.body) {
        ts.forEachChild(node.body, (child) => visit(child, [...stack, newFrame]));
      }
      return;
    }

    // Arrow function
    if (ts.isArrowFunction(node)) {
      const arrowName = `arrow#${getNextOccurrence("arrow")}`;
      const newFrame: ScopeFrame = {
        nameSegment: arrowName,
        kind: "function",
        occurrence: 0,
      };

      if (ts.isBlock(node.body)) {
        ts.forEachChild(node.body, (child) => visit(child, [...stack, newFrame]));
      } else {
        visit(node.body, [...stack, newFrame]);
      }
      return;
    }

    // Function expression
    if (ts.isFunctionExpression(node)) {
      const funcName = node.name?.text ?? `function#${getNextOccurrence("function")}`;
      const newFrame: ScopeFrame = {
        nameSegment: funcName,
        kind: "function",
        occurrence: getNextOccurrence(`func:${funcName}`),
      };

      if (node.body) {
        ts.forEachChild(node.body, (child) => visit(child, [...stack, newFrame]));
      }
      return;
    }

    // Class declaration
    if (ts.isClassDeclaration(node)) {
      const className = node.name?.text ?? `class#${getNextOccurrence("class")}`;
      const newFrame: ScopeFrame = {
        nameSegment: className,
        kind: "class",
        occurrence: getNextOccurrence(`class:${className}`),
      };

      node.members.forEach((member) => {
        if (ts.isMethodDeclaration(member) || ts.isPropertyDeclaration(member)) {
          const memberName = member.name && ts.isIdentifier(member.name) ? member.name.text : null;
          if (memberName) {
            const memberFrame: ScopeFrame = {
              nameSegment: memberName,
              kind: ts.isMethodDeclaration(member) ? "method" : "property",
              occurrence: getNextOccurrence(`member:${className}.${memberName}`),
            };

            if (ts.isMethodDeclaration(member) && member.body) {
              ts.forEachChild(member.body, (child) => visit(child, [...stack, newFrame, memberFrame]));
            } else if (ts.isPropertyDeclaration(member) && member.initializer) {
              visit(member.initializer, [...stack, newFrame, memberFrame]);
            }
          }
        }
      });
      return;
    }

    // Object literal property
    if (ts.isPropertyAssignment(node)) {
      const propName = getPropertyName(node.name);
      if (propName) {
        const newFrame: ScopeFrame = {
          nameSegment: propName,
          kind: "property",
          occurrence: getNextOccurrence(`prop:${propName}`),
        };

        visit(node.initializer, [...stack, newFrame]);
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
export const typeScriptAdapter: AnalyzerAdapter<ts.SourceFile, ts.CallExpression> = {
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

/**
 * Main exported analyzer function that uses the TypeScript adapter
 */
export const analyzeModule = (input: AnalyzeModuleInput): ModuleAnalysis => {
  return analyzeModuleCore(input, typeScriptAdapter);
};
