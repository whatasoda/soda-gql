import { parseSync } from "@swc/core";
import type {
  ArrowFunctionExpression,
  CallExpression,
  Callee,
  ExportDeclaration,
  ExportSpecifier,
  FnDecl,
  Identifier,
  ImportDeclaration,
  ImportSpecifier,
  MemberExpression,
  Module,
  ModuleDeclaration,
  ModuleItem,
  Param,
  Pattern,
  Program,
  Span,
  Statement,
} from "@swc/types";

import {
  type AnalyzeModuleInput,
  type GqlDefinitionKind,
  type ModuleAnalysis,
  type ModuleDefinition,
  type ModuleDiagnostic,
  type ModuleExport,
  type ModuleImport,
  type SourceLocation,
  type SourcePosition,
  analyzeModule as analyzeModuleTs,
} from "./analyze-module";

const gqlCallKinds: Record<string, GqlDefinitionKind> = {
  model: "model",
  querySlice: "slice",
  query: "operation",
  mutation: "operation",
  subscription: "operation",
};

const getLineStarts = (source: string): readonly number[] => {
  const starts: number[] = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
};

const toPositionResolver = (source: string) => {
  const lineStarts = getLineStarts(source);
  return (offset: number): SourcePosition => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const start = lineStarts[mid];
      const next = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : source.length + 1;
      if (offset < start) {
        high = mid - 1;
      } else if (offset >= next) {
        low = mid + 1;
      } else {
        return { line: mid + 1, column: offset - start + 1 } satisfies SourcePosition;
      }
    }
    return {
      line: lineStarts.length,
      column: offset - lineStarts[lineStarts.length - 1] + 1,
    } satisfies SourcePosition;
  };
};

const toLocation = (resolvePosition: (offset: number) => SourcePosition, span: Span): SourceLocation => ({
  start: resolvePosition(span.start),
  end: resolvePosition(span.end),
});

const collectImports = (module: Module): ModuleImport[] => {
  const imports: ModuleImport[] = [];
  module.body.forEach((item) => {
    if (item.type !== "ModuleDeclaration") {
      return;
    }
    const declaration = item.declaration;
    if (declaration.type !== "ImportDeclaration") {
      return;
    }

    const source = declaration.source.value;
    declaration.specifiers?.forEach((specifier) => {
      if (specifier.type === "ImportSpecifier") {
        const imported = specifier.imported ? specifier.imported.value : specifier.local.value;
        imports.push({
          source,
          imported,
          local: specifier.local.value,
          kind: "named",
          isTypeOnly: Boolean(specifier.isTypeOnly),
        });
        return;
      }
      if (specifier.type === "ImportNamespaceSpecifier") {
        imports.push({
          source,
          imported: "*",
          local: specifier.local.value,
          kind: "namespace",
          isTypeOnly: false,
        });
        return;
      }
      if (specifier.type === "ImportDefaultSpecifier") {
        imports.push({
          source,
          imported: "default",
          local: specifier.local.value,
          kind: "default",
          isTypeOnly: false,
        });
      }
    });
  });
  return imports;
};

const collectExports = (module: Module): ModuleExport[] => {
  const exports: ModuleExport[] = [];
  module.body.forEach((item) => {
    if (item.type !== "ModuleDeclaration") {
      return;
    }
    const declaration = item.declaration;

    if (declaration.type === "ExportDeclaration") {
      if (declaration.declaration.type === "VariableDeclaration") {
        declaration.declaration.declarations.forEach((decl) => {
          if (decl.id.type === "Identifier") {
            exports.push({
              kind: "named",
              exported: decl.id.value,
              local: decl.id.value,
              isTypeOnly: false,
            });
          }
        });
      }
      if (declaration.declaration.type === "FunctionDeclaration") {
        const ident = declaration.declaration.identifier;
        if (ident) {
          exports.push({
            kind: "named",
            exported: ident.value,
            local: ident.value,
            isTypeOnly: false,
          });
        }
      }
      return;
    }

    if (declaration.type === "ExportNamedDeclaration") {
      const source = declaration.source?.value;
      declaration.specifiers?.forEach((specifier) => {
        if (specifier.type !== "ExportSpecifier") {
          return;
        }
        const exported = specifier.exported ? specifier.exported.value : specifier.orig.value;
        const local = specifier.orig.value;
        if (source) {
          exports.push({
            kind: "reexport",
            exported,
            local,
            source,
            isTypeOnly: Boolean(specifier.isTypeOnly),
          });
          return;
        }
        exports.push({
          kind: "named",
          exported,
          local,
          isTypeOnly: Boolean(specifier.isTypeOnly),
        });
      });
      return;
    }

    if (declaration.type === "ExportAllDeclaration") {
      exports.push({
        kind: "reexport",
        exported: "*",
        source: declaration.source.value,
        isTypeOnly: false,
      });
    }
  });
  return exports;
};

const collectGqlIdentifiers = (module: Module): ReadonlySet<string> => {
  const identifiers = new Set<string>();
  module.body.forEach((item) => {
    if (item.type !== "ModuleDeclaration") {
      return;
    }
    const declaration = item.declaration;
    if (declaration.type !== "ImportDeclaration") {
      return;
    }
    if (!declaration.source.value.endsWith("/graphql-system")) {
      return;
    }
    declaration.specifiers?.forEach((specifier) => {
      if (specifier.type === "ImportSpecifier") {
        const imported = specifier.imported ? specifier.imported.value : specifier.local.value;
        if (imported === "gql") {
          identifiers.add(specifier.local.value);
        }
      }
    });
  });
  return identifiers;
};

const isGqlCall = (
  identifiers: ReadonlySet<string>,
  call: CallExpression,
): { readonly method: string; readonly callee: MemberExpression } | null => {
  const callee = call.callee;
  if (callee.type !== "Expression") {
    return null;
  }
  const expression = callee.expression;
  if (expression.type !== "MemberExpression") {
    return null;
  }
  if (expression.object.type !== "Identifier") {
    return null;
  }
  if (!identifiers.has(expression.object.value)) {
    return null;
  }
  if (expression.property.type !== "Identifier") {
    return null;
  }
  const method = expression.property.value;
  if (!(method in gqlCallKinds)) {
    return null;
  }
  return { method, callee: expression };
};

const collectIdentifiersFromPattern = (pattern: Pattern, into: Set<string>) => {
  if (pattern.type === "Identifier") {
    into.add(pattern.value);
    return;
  }
  if (pattern.type === "ObjectPattern") {
    pattern.properties.forEach((prop) => {
      if (prop.type === "KeyValuePatternProperty") {
        collectIdentifiersFromPattern(prop.value, into);
      }
      if (prop.type === "AssignmentPatternProperty") {
        collectIdentifiersFromPattern(prop.key, into);
      }
    });
    return;
  }
  if (pattern.type === "ArrayPattern") {
    pattern.elements.forEach((element) => {
      if (!element) {
        return;
      }
      if (element.type === "Identifier") {
        into.add(element.value);
        return;
      }
      if (element.type === "AssignmentPattern") {
        collectIdentifiersFromPattern(element.left, into);
        return;
      }
      if (element.type === "RestElement") {
        collectIdentifiersFromPattern(element.argument, into);
      }
    });
  }
};

const collectParameterIdentifiers = (params: readonly Param[]): Set<string> => {
  const identifiers = new Set<string>();
  params.forEach((param) => {
    collectIdentifiersFromPattern(param.pat, identifiers);
  });
  return identifiers;
};

const collectReferencesFromExpression = (
  expression: CallExpression,
  imports: readonly ModuleImport[],
  definitionNames: ReadonlySet<string>,
  gqlIdentifiers: ReadonlySet<string>,
): Set<string> => {
  const namedImports = new Set<string>();
  const namespaceImports = new Set<string>();

  imports.forEach((entry) => {
    if (entry.kind === "named" || entry.kind === "default") {
      namedImports.add(entry.local);
    }
    if (entry.kind === "namespace") {
      namespaceImports.add(entry.local);
    }
  });

  const references = new Set<string>();

  const visit = (node: any, exclusions: Set<string>) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.type === "Identifier") {
      const name = node.value;
      if (exclusions.has(name)) {
        return;
      }
      if (namedImports.has(name) || definitionNames.has(name)) {
        if (!gqlIdentifiers.has(name)) {
          references.add(name);
        }
      }
      return;
    }

    if (node.type === "MemberExpression") {
      if (node.object.type === "Identifier") {
        const base = node.object.value;
        if (!exclusions.has(base)) {
          if (namespaceImports.has(base)) {
            if (node.property.type === "Identifier") {
              references.add(node.property.value);
              references.add(`${base}.${node.property.value}`);
            }
          } else if (namedImports.has(base) || definitionNames.has(base)) {
            if (!gqlIdentifiers.has(base)) {
              references.add(base);
            }
          }
        }
      }
      visit(node.object, exclusions);
      if (node.property && node.property.type !== "Identifier") {
        visit(node.property, exclusions);
      }
      return;
    }

    if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
      const next = new Set(exclusions);
      node.params?.forEach((param: Param) => {
        collectIdentifiersFromPattern(param.pat, next);
      });

      if (node.body) {
        visit(node.body, next);
      }
      return;
    }

    if (node.type === "FunctionDeclaration") {
      const next = new Set(exclusions);
      node.function.params?.forEach((param: Param) => {
        collectIdentifiersFromPattern(param.pat, next);
      });
      visit(node.function.body, next);
      return;
    }

    if (node.type === "BlockStatement") {
      node.statements?.forEach((statement: any) => visit(statement, exclusions));
      return;
    }

    if (node.type === "CallExpression") {
      visit(node.callee, exclusions);
      node.arguments?.forEach((arg: any) => visit(arg.expression ?? arg, exclusions));
      return;
    }

    if (node.type === "StringLiteral" || node.type === "NumericLiteral" || node.type === "BooleanLiteral") {
      return;
    }

    if (node.type === "ArrayExpression") {
      node.elements?.forEach((element: any) => {
        if (element?.expression) {
          visit(element.expression, exclusions);
        }
      });
      return;
    }

    if (node.type === "ObjectExpression") {
      node.properties?.forEach((prop: any) => {
        if (prop.type === "KeyValueProperty") {
          visit(prop.value, exclusions);
        }
        if (prop.type === "GetterProperty" || prop.type === "SetterProperty") {
          visit(prop.body, exclusions);
        }
      });
      return;
    }

    if (node.type === "ConditionalExpression") {
      visit(node.test, exclusions);
      visit(node.consequent, exclusions);
      visit(node.alternate, exclusions);
      return;
    }

    if (node.type === "TemplateLiteral") {
      node.expressions?.forEach((expr: any) => visit(expr, exclusions));
      return;
    }

    if (node.type === "AssignmentExpression") {
      visit(node.left, exclusions);
      visit(node.right, exclusions);
      return;
    }

    Object.values(node).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((child) => visit(child, exclusions));
      } else {
        visit(value, exclusions);
      }
    });
  };

  const baseExclusions = new Set<string>([...gqlIdentifiers]);
  visit(expression, baseExclusions);

  return references;
};

const collectTopLevelDefinitions = (
  module: Module,
  gqlIdentifiers: ReadonlySet<string>,
  imports: readonly ModuleImport[],
  resolvePosition: (offset: number) => SourcePosition,
): {
  readonly definitions: ModuleDefinition[];
  readonly handledCalls: Set<CallExpression>;
} => {
  type Pending = {
    readonly exportName: string;
    readonly kind: GqlDefinitionKind;
    readonly initializer: CallExpression;
    readonly span: Span;
  };

  const pending: Pending[] = [];
  const handled = new Set<CallExpression>();

  const register = (exportName: string, initializer: CallExpression, span: Span, kind: GqlDefinitionKind) => {
    handled.add(initializer);
    pending.push({ exportName, initializer, span, kind });
  };

  module.body.forEach((item) => {
    if (item.type === "ModuleDeclaration") {
      const declaration = item.declaration;

      if (declaration.type === "ExportDeclaration" && declaration.declaration.type === "VariableDeclaration") {
        declaration.declaration.declarations.forEach((decl) => {
          if (decl.id.type !== "Identifier" || !decl.init || decl.init.type !== "CallExpression") {
            return;
          }
          const gqlCall = isGqlCall(gqlIdentifiers, decl.init);
          if (!gqlCall) {
            return;
          }
          register(decl.id.value, decl.init, decl.span ?? decl.init.span, gqlCallKinds[gqlCall.method]);
        });
        return;
      }

      if (declaration.type === "ExportNamedDeclaration" && declaration.declaration && declaration.declaration.type === "VariableDeclaration") {
        declaration.declaration.declarations.forEach((decl) => {
          if (decl.id.type !== "Identifier" || !decl.init || decl.init.type !== "CallExpression") {
            return;
          }
          const gqlCall = isGqlCall(gqlIdentifiers, decl.init);
          if (!gqlCall) {
            return;
          }
          register(decl.id.value, decl.init, decl.span ?? decl.init.span, gqlCallKinds[gqlCall.method]);
        });
      }
    }
  });

  const definitionNames = new Set(pending.map((item) => item.exportName));
  const definitions = pending.map((item) => ({
    kind: item.kind,
    exportName: item.exportName,
    loc: toLocation(resolvePosition, item.span),
    references: Array.from(collectReferencesFromExpression(item.initializer, imports, definitionNames, gqlIdentifiers)),
  } satisfies ModuleDefinition));

  return { definitions, handledCalls: handled };
};

const collectDiagnostics = (
  module: Module,
  gqlIdentifiers: ReadonlySet<string>,
  handled: ReadonlySet<CallExpression>,
  resolvePosition: (offset: number) => SourcePosition,
): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];

  const visit = (node: any) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.type === "CallExpression") {
      if (!handled.has(node)) {
        const gqlCall = isGqlCall(gqlIdentifiers, node);
        if (gqlCall) {
          diagnostics.push({
            code: "NON_TOP_LEVEL_DEFINITION",
            message: "gql.* definitions must be declared at module top-level",
            loc: toLocation(resolvePosition, node.span),
          });
        }
      }
    }
    Object.values(node).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else {
        visit(value);
      }
    });
  };

  module.body.forEach((item) => visit(item));
  return diagnostics;
};

export const analyzeModule = ({ filePath, source }: AnalyzeModuleInput): ModuleAnalysis => {
  const program = parseSync(source, {
    syntax: "typescript",
    tsx: filePath.endsWith(".tsx"),
    target: "es2022",
    decorators: false,
    dynamicImport: true,
  });

  if (program.type !== "Module") {
    return analyzeModuleTs({ filePath, source });
  }

  const module = program as Module;
  const resolvePosition = toPositionResolver(source);

  const imports = collectImports(module);
  const exports = collectExports(module);
  const gqlIdentifiers = collectGqlIdentifiers(module);
  const { definitions, handledCalls } = collectTopLevelDefinitions(module, gqlIdentifiers, imports, resolvePosition);
  const diagnostics = collectDiagnostics(module, gqlIdentifiers, handledCalls, resolvePosition);

  return {
    filePath,
    sourceHash: Bun.hash(source).toString(16),
    definitions,
    diagnostics,
    imports,
    exports,
  } satisfies ModuleAnalysis;
};
