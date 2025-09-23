import ts from "typescript";
import { extname, dirname, resolve as resolvePath } from "node:path";
import { ok } from "neverthrow";

export type SourcePosition = {
  readonly line: number;
  readonly column: number;
};

export type SourceLocation = {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
};

export type GqlDefinitionKind = "model" | "slice" | "operation";

export type ModuleDefinition = {
  readonly kind: GqlDefinitionKind;
  readonly exportName: string;
  readonly loc: SourceLocation;
  readonly references: readonly string[];
};

export type ModuleDiagnostic = {
  readonly code: "NON_TOP_LEVEL_DEFINITION";
  readonly message: string;
  readonly loc: SourceLocation;
};

export type ModuleImport = {
  readonly source: string;
  readonly imported: string;
  readonly local: string;
  readonly kind: "named" | "namespace" | "default";
  readonly isTypeOnly: boolean;
};

export type ModuleExport =
  | {
      readonly kind: "named";
      readonly exported: string;
      readonly local: string;
      readonly source?: undefined;
      readonly isTypeOnly: boolean;
    }
  | {
      readonly kind: "reexport";
      readonly exported: string;
      readonly source: string;
      readonly local?: string;
      readonly isTypeOnly: boolean;
    };

export type ModuleAnalysis = {
  readonly filePath: string;
  readonly sourceHash: string;
  readonly definitions: readonly ModuleDefinition[];
  readonly diagnostics: readonly ModuleDiagnostic[];
  readonly imports: readonly ModuleImport[];
  readonly exports: readonly ModuleExport[];
};

export type AnalyzeModuleInput = {
  readonly filePath: string;
  readonly source: string;
};

const gqlDefinitionKinds: Record<string, GqlDefinitionKind> = {
  model: "model",
  querySlice: "slice",
  query: "operation",
  mutation: "operation",
  subscription: "operation",
};

const createSourceFile = (filePath: string, source: string): ts.SourceFile => {
  const scriptKind = extname(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, scriptKind);
};

const createHash = (source: string): string => Bun.hash(source).toString(16);

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
      const moduleSpecifier = statement.moduleSpecifier
        ? (statement.moduleSpecifier as ts.StringLiteral).text
        : undefined;

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

    if (ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
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

    if (ts.isFunctionDeclaration(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) && statement.name) {
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

const isGqlDefinitionCall = (identifiers: ReadonlySet<string>, callExpression: ts.CallExpression): { readonly method: string } | null => {
  const expression = callExpression.expression;
  if (!ts.isPropertyAccessExpression(expression)) {
    return null;
  }

  if (!ts.isIdentifier(expression.expression) || !identifiers.has(expression.expression.text)) {
    return null;
  }

  const method = expression.name.text;
  if (!(method in gqlDefinitionKinds)) {
    return null;
  }

  return { method };
};

const collectTopLevelDefinitions = (
  sourceFile: ts.SourceFile,
  identifiers: ReadonlySet<string>,
): {
  readonly definitions: ModuleDefinition[];
  readonly handledCalls: Set<ts.CallExpression>;
} => {
  const definitions: ModuleDefinition[] = [];
  const handledCalls = new Set<ts.CallExpression>();

  sourceFile.statements.forEach((statement) => {
    if (!ts.isVariableStatement(statement)) {
      return;
    }

    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      return;
    }

    statement.declarationList.declarations.forEach((declaration) => {
      if (!ts.isIdentifier(declaration.name)) {
        return;
      }

      if (!declaration.initializer || !ts.isCallExpression(declaration.initializer)) {
        return;
      }

      const gqlCall = isGqlDefinitionCall(identifiers, declaration.initializer);
      if (!gqlCall) {
        return;
      }

      handledCalls.add(declaration.initializer);

      definitions.push({
        kind: gqlDefinitionKinds[gqlCall.method],
        exportName: declaration.name.text,
        loc: toLocation(sourceFile, declaration),
        references: [],
      });
    });
  });

  return { definitions, handledCalls };
};

const collectDiagnostics = (
  sourceFile: ts.SourceFile,
  identifiers: ReadonlySet<string>,
  handledCalls: ReadonlySet<ts.CallExpression>,
): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (!handledCalls.has(node)) {
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

export const analyzeModule = ({ filePath, source }: AnalyzeModuleInput): ModuleAnalysis => {
  const sourceFile = createSourceFile(filePath, source);
  const gqlIdentifiers = collectGqlImports(sourceFile);
  const { definitions, handledCalls } = collectTopLevelDefinitions(sourceFile, gqlIdentifiers);
  const diagnostics = collectDiagnostics(sourceFile, gqlIdentifiers, handledCalls);

  return {
    filePath,
    sourceHash: createHash(source),
    definitions,
    diagnostics,
    imports: collectImports(sourceFile),
    exports: collectExports(sourceFile),
  } satisfies ModuleAnalysis;
};
