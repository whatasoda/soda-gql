import { extname } from "node:path";
import { unwrapNullish } from "@soda-gql/tool-utils";
import ts from "typescript";

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
  readonly expression: string;
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

const isGqlDefinitionCall = (
  identifiers: ReadonlySet<string>,
  callExpression: ts.CallExpression,
): { readonly method: string } | null => {
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

const collectParameterIdentifiers = (parameter: ts.BindingName, into: Set<string>): void => {
  if (ts.isIdentifier(parameter)) {
    into.add(parameter.text);
    return;
  }

  if (ts.isObjectBindingPattern(parameter)) {
    parameter.elements.forEach((element) => {
      if (element.name) {
        collectParameterIdentifiers(element.name, into);
      }
    });
    return;
  }

  if (ts.isArrayBindingPattern(parameter)) {
    parameter.elements.forEach((element) => {
      if (ts.isBindingElement(element) && element.name) {
        collectParameterIdentifiers(element.name, into);
      }
    });
  }
};

const collectReferencesFromCall = (
  initializer: ts.CallExpression,
  imports: readonly ModuleImport[],
  definitionNames: ReadonlySet<string>,
  identifiers: ReadonlySet<string>,
): Set<string> => {
  const namedImportLocals = new Set<string>();
  const namespaceImportLocals = new Set<string>();

  imports.forEach((entry) => {
    if (entry.kind === "named" || entry.kind === "default") {
      namedImportLocals.add(entry.local);
    }
    if (entry.kind === "namespace") {
      namespaceImportLocals.add(entry.local);
    }
  });

  const references = new Set<string>();
  const baseExclusions = new Set<string>(["gql"]);

  const resolvePropertyAccess = (
    expression: ts.Expression,
  ): { readonly root: string; readonly segments: readonly string[] } | null => {
    const segments: string[] = [];
    let current: ts.Expression = expression;

    while (true) {
      if (ts.isPropertyAccessExpression(current)) {
        segments.unshift(current.name.text);
        current = current.expression;
        continue;
      }

      if (ts.isIdentifier(current)) {
        return {
          root: current.text,
          segments,
        } as const;
      }

      return null;
    }
  };

  const registerNamespaceReference = (root: string, segments: readonly string[]) => {
    if (segments.length === 0) {
      return;
    }

    for (let index = 0; index < segments.length; index += 1) {
      const slice = segments.slice(0, index + 1).join(".");
      references.add(slice);
      references.add(`${root}.${slice}`);
    }
  };

  const registerNamedReference = (root: string, segments: readonly string[]) => {
    if (segments.length === 0) {
      if (!identifiers.has(root)) {
        references.add(root);
      }
      return;
    }

    const suffix = segments.join(".");
    references.add(`${root}.${suffix}`);
  };

  const visitNode = (node: ts.Node, exclusions: Set<string>) => {
    if (ts.isCallExpression(node)) {
      visitNode(node.expression, exclusions);
      node.arguments.forEach((argument) => {
        visitNode(argument, exclusions);
      });
      return;
    }

    if (ts.isFunctionLike(node) && node.parameters) {
      const nextExclusions = new Set(exclusions);
      node.parameters.forEach((parameter) => {
        collectParameterIdentifiers(parameter.name, nextExclusions);
      });

      if (ts.isArrowFunction(node) && node.equalsGreaterThanToken) {
        if (node.body) {
          if (ts.isBlock(node.body)) {
            node.body.statements.forEach((statement) => {
              visitNode(statement, nextExclusions);
            });
          } else {
            visitNode(node.body, nextExclusions);
          }
        }
        return;
      }

      if (node.body && ts.isBlock(node.body)) {
        node.body.statements.forEach((statement) => {
          visitNode(statement, nextExclusions);
        });
      }
      return;
    }

    if (ts.isPropertyAccessExpression(node)) {
      const resolved = resolvePropertyAccess(node);
      if (resolved) {
        const { root, segments } = resolved;
        if (!exclusions.has(root)) {
          if (namespaceImportLocals.has(root)) {
            registerNamespaceReference(root, segments);
          } else if (namedImportLocals.has(root)) {
            registerNamedReference(root, segments);
          } else {
            const fullName = segments.length > 0 ? `${root}.${segments.join(".")}` : root;
            if (definitionNames.has(fullName)) {
              references.add(fullName);
            } else if (definitionNames.has(root) && segments.length === 0 && !identifiers.has(root)) {
              references.add(root);
            }
          }
        }
      }

      visitNode(node.expression, exclusions);
      return;
    }

    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (exclusions.has(name)) {
        return;
      }

      if (namedImportLocals.has(name) || definitionNames.has(name)) {
        if (!identifiers.has(name)) {
          references.add(name);
        }
      }
      return;
    }

    ts.forEachChild(node, (child) => visitNode(child, exclusions));
  };

  visitNode(initializer, baseExclusions);

  return references;
};

const collectTopLevelDefinitions = (
  sourceFile: ts.SourceFile,
  identifiers: ReadonlySet<string>,
  imports: readonly ModuleImport[],
): {
  readonly definitions: ModuleDefinition[];
  readonly handledCalls: Set<ts.CallExpression>;
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
    readonly kind: GqlDefinitionKind;
    readonly loc: SourceLocation;
    readonly initializer: ts.CallExpression;
    readonly expression: string;
  };

  const pending: PendingDefinition[] = [];
  const handledCalls = new Set<ts.CallExpression>();

  const register = (exportName: string, initializer: ts.CallExpression, span: ts.Node, kind: GqlDefinitionKind) => {
    handledCalls.add(initializer);
    pending.push({
      exportName,
      kind,
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
        const gqlCall = isGqlDefinitionCall(identifiers, initializer);
        if (!gqlCall) {
          return;
        }
        register(exportName, initializer, declaration, unwrapNullish(gqlDefinitionKinds[gqlCall.method], "validated-map-lookup"));
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

          const gqlCall = isGqlDefinitionCall(identifiers, property.initializer);
          if (!gqlCall) {
            return;
          }

          register(
            `${exportName}.${name}`,
            property.initializer,
            property,
            unwrapNullish(gqlDefinitionKinds[gqlCall.method], "validated-map-lookup"),
          );
        });
      }
    });
  });

  const definitionNames = new Set<string>(pending.map((item) => item.exportName));

  const definitions = pending.map(
    (item) =>
      ({
        kind: item.kind,
        exportName: item.exportName,
        loc: item.loc,
        references: Array.from(collectReferencesFromCall(item.initializer, imports, definitionNames, identifiers)),
        expression: item.expression,
      }) satisfies ModuleDefinition,
  );

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
  const imports = collectImports(sourceFile);
  const exports = collectExports(sourceFile);
  const { definitions, handledCalls } = collectTopLevelDefinitions(sourceFile, gqlIdentifiers, imports);
  const diagnostics = collectDiagnostics(sourceFile, gqlIdentifiers, handledCalls);

  return {
    filePath,
    sourceHash: createHash(source),
    definitions,
    diagnostics,
    imports,
    exports,
  } satisfies ModuleAnalysis;
};
