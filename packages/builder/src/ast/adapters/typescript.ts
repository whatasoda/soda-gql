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

const collectTopLevelDefinitions = (
  sourceFile: ts.SourceFile,
  identifiers: ReadonlySet<string>,
  _imports: readonly ModuleImport[],
  _source: string,
): {
  readonly definitions: ModuleDefinition[];
  readonly handledCalls: readonly ts.CallExpression[];
} => {
  const getPropertyName = (name: ts.PropertyName): string | null => {
    if (ts.isIdentifier(name)) {
      return name.text;
    }
    if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      return name.text;
    }
    return null;
  };

  type PendingDefinition = {
    readonly exportName: string;
    readonly loc: SourceLocation;
    readonly initializer: ts.CallExpression;
    readonly expression: string;
  };

  const pending: PendingDefinition[] = [];
  const handledCalls: ts.CallExpression[] = [];

  const register = (exportName: string, initializer: ts.CallExpression, span: ts.Node) => {
    handledCalls.push(initializer);
    pending.push({
      exportName,
      loc: toLocation(sourceFile, span),
      initializer,
      expression: initializer.getText(sourceFile),
    });
  };

  sourceFile.statements.forEach((statement) => {
    if (!ts.isVariableStatement(statement)) {
      return;
    }

    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      return;
    }

    statement.declarationList.declarations.forEach((declaration) => {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
        return;
      }

      const exportName = declaration.name.text;
      const initializer = declaration.initializer;

      if (ts.isCallExpression(initializer)) {
        if (!isGqlDefinitionCall(identifiers, initializer)) {
          return;
        }
        register(exportName, initializer, declaration);
        return;
      }

      if (ts.isObjectLiteralExpression(initializer)) {
        initializer.properties.forEach((property) => {
          if (!ts.isPropertyAssignment(property)) {
            return;
          }

          const name = getPropertyName(property.name);
          if (!name) {
            return;
          }

          if (!ts.isCallExpression(property.initializer)) {
            return;
          }

          if (!isGqlDefinitionCall(identifiers, property.initializer)) {
            return;
          }

          register(`${exportName}.${name}`, property.initializer, property);
        });
      }
    });
  });

  const definitions = pending.map(
    (item) =>
      ({
        exportName: item.exportName,
        loc: item.loc,
        expression: item.expression,
      }) satisfies ModuleDefinition,
  );

  return { definitions, handledCalls };
};

const collectDiagnostics = (
  sourceFile: ts.SourceFile,
  identifiers: ReadonlySet<string>,
  handledCalls: readonly ts.CallExpression[],
): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];
  const handledSet = new Set(handledCalls);

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (!handledSet.has(node)) {
        const gqlCall = isGqlDefinitionCall(identifiers, node);
        if (gqlCall) {
          diagnostics.push({
            code: "NON_TOP_LEVEL_DEFINITION",
            message: "gql.* definitions must be declared at module top-level",
            loc: toLocation(sourceFile, node),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  sourceFile.statements.forEach((statement) => {
    ts.forEachChild(statement, visit);
  });

  return diagnostics;
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
      readonly source: string;
    },
  ): {
    readonly definitions: readonly ModuleDefinition[];
    readonly handles: readonly ts.CallExpression[];
  } {
    const { definitions, handledCalls } = collectTopLevelDefinitions(
      file,
      context.gqlIdentifiers,
      context.imports,
      context.source,
    );
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
