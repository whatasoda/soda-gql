import { unwrapNullish } from "@soda-gql/tool-utils";
import { parseSync } from "@swc/core";
import type {
  CallExpression,
  ImportDeclaration,
  MemberExpression,
  Module,
  Param,
  Pattern,
  Span,
  VariableDeclaration,
} from "@swc/types";

import {
  type AnalyzeModuleInput,
  analyzeModule as analyzeModuleTs,
  type GqlDefinitionKind,
  type ModuleAnalysis,
  type ModuleDefinition,
  type ModuleDiagnostic,
  type ModuleExport,
  type ModuleImport,
  type SourceLocation,
  type SourcePosition,
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
      const start = unwrapNullish(lineStarts[mid], "safe-array-item-access");
      const next = mid + 1 < lineStarts.length ? unwrapNullish(lineStarts[mid + 1], "safe-array-item-access") : source.length + 1;
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
      column: offset - unwrapNullish(lineStarts[lineStarts.length - 1], "safe-array-item-access") + 1,
    } satisfies SourcePosition;
  };
};

const toLocation = (resolvePosition: (offset: number) => SourcePosition, span: Span): SourceLocation => ({
  start: resolvePosition(span.start),
  end: resolvePosition(span.end),
});

const collectImports = (module: Module): ModuleImport[] => {
  const imports: ModuleImport[] = [];

  const handle = (declaration: ImportDeclaration) => {
    const source = declaration.source.value;
    // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
    declaration.specifiers?.forEach((specifier: any) => {
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
  };

  module.body.forEach((item) => {
    if (item.type === "ImportDeclaration") {
      handle(item);
      return;
    }
    // Handle module declarations with import declarations
    if (
      "declaration" in item &&
      item.declaration &&
      "type" in item.declaration &&
      // biome-ignore lint/suspicious/noExplicitAny: SWC type cast
      (item.declaration as any).type === "ImportDeclaration"
    ) {
      // biome-ignore lint/suspicious/noExplicitAny: SWC type cast
      handle(item.declaration as any as ImportDeclaration);
    }
  });

  return imports;
};

const collectExports = (module: Module): ModuleExport[] => {
  const exports: ModuleExport[] = [];

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const handle = (declaration: any) => {
    if (declaration.type === "ExportDeclaration") {
      if (declaration.declaration.type === "VariableDeclaration") {
        // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
        declaration.declaration.declarations.forEach((decl: any) => {
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
      // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
      declaration.specifiers?.forEach((specifier: any) => {
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
  };

  module.body.forEach((item) => {
    if (item.type === "ExportDeclaration" || item.type === "ExportNamedDeclaration" || item.type === "ExportAllDeclaration") {
      handle(item);
      return;
    }

    if ("declaration" in item && item.declaration) {
      // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
      const declaration = item.declaration as any;
      if (
        declaration.type === "ExportDeclaration" ||
        declaration.type === "ExportNamedDeclaration" ||
        declaration.type === "ExportAllDeclaration"
      ) {
        // biome-ignore lint/suspicious/noExplicitAny: Complex SWC AST type
        handle(declaration as any);
      }
    }
  });

  return exports;
};

const collectGqlIdentifiers = (module: Module): ReadonlySet<string> => {
  const identifiers = new Set<string>();
  module.body.forEach((item) => {
    const declaration =
      item.type === "ImportDeclaration"
        ? item
        : // biome-ignore lint/suspicious/noExplicitAny: SWC AST type checking
          "declaration" in item && item.declaration && (item.declaration as any).type === "ImportDeclaration"
          ? // biome-ignore lint/suspicious/noExplicitAny: SWC type cast
            (item.declaration as any as ImportDeclaration)
          : null;
    if (!declaration) {
      return;
    }
    if (!declaration.source.value.endsWith("/graphql-system")) {
      return;
    }
    // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
    declaration.specifiers?.forEach((specifier: any) => {
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
): { readonly method: string; readonly callee: MemberExpression; readonly schemaName?: string } | null => {
  const callee = call.callee;
  let expression: MemberExpression | null = null;

  if (callee.type === "MemberExpression") {
    expression = callee;
  } else if (callee.type === "Super" || callee.type === "Import") {
    return null;
    // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  } else if ((callee as any).expression && (callee as any).expression.type === "MemberExpression") {
    // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
    expression = (callee as any).expression as MemberExpression;
  } else {
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
  
  // Check if it's a direct method call (old pattern)
  if (method in gqlCallKinds) {
    return { method, callee: expression };
  }
  
  // Check if it's a schema factory call (new pattern like gql.default or gql.admin)
  if (method === "default" || method === "admin") {
    // This is a factory call, we need to look inside for the actual method
    if (call.arguments.length > 0) {
      const firstArg = call.arguments[0];
      
      // Check if it's an arrow function
      if (firstArg && firstArg.expression && firstArg.expression.type === "ArrowFunctionExpression") {
        const arrowFunc = firstArg.expression as any;
        
        // Check if the body is a call expression
        if (arrowFunc.body && arrowFunc.body.type === "CallExpression") {
          const innerCall = arrowFunc.body as CallExpression;
          
          // Check if it's calling a method directly
          if (innerCall.callee.type === "Identifier") {
            const innerMethod = innerCall.callee.value;
            if (innerMethod in gqlCallKinds) {
              return { method: innerMethod, callee: expression, schemaName: method };
            }
          }
          // Check if it's calling via property access
          else if (innerCall.callee.type === "MemberExpression") {
            const innerExpr = innerCall.callee as MemberExpression;
            if (innerExpr.property.type === "Identifier") {
              const innerMethod = innerExpr.property.value;
              if (innerMethod in gqlCallKinds) {
                return { method: innerMethod, callee: expression, schemaName: method };
              }
            }
          }
        }
      }
    }
  }
  
  return null;
};;

const collectIdentifiersFromPattern = (pattern: Pattern | null | undefined, into: Set<string>) => {
  if (!pattern) {
    return;
  }
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

const _collectParameterIdentifiers = (params: readonly Param[]): Set<string> => {
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

  const resolveMemberPath = (node: MemberExpression): { readonly root: string; readonly segments: readonly string[] } | null => {
    const segments: string[] = [];
    let current: MemberExpression["object"] | MemberExpression = node;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (current.type === "MemberExpression") {
        const property = current.property;
        if (property.type === "Identifier") {
          segments.unshift(property.value);
          // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
        } else if ((property as any).type === "StringLiteral" || (property as any).type === "NumericLiteral") {
          // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
          segments.unshift(String((property as any).value));
        } else {
          return null;
        }

        current = current.object;
        continue;
      }

      if (current.type === "Identifier") {
        return {
          root: current.value,
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
      if (!gqlIdentifiers.has(root)) {
        references.add(root);
      }
      return;
    }

    const suffix = segments.join(".");
    references.add(`${root}.${suffix}`);
  };

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
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
      const resolved = resolveMemberPath(node);
      if (resolved) {
        const { root, segments } = resolved;
        if (!exclusions.has(root)) {
          if (namespaceImports.has(root)) {
            registerNamespaceReference(root, segments);
          } else if (namedImports.has(root)) {
            registerNamedReference(root, segments);
          } else {
            const fullName = segments.length > 0 ? `${root}.${segments.join(".")}` : root;
            if (definitionNames.has(fullName)) {
              references.add(fullName);
            } else if (definitionNames.has(root) && segments.length === 0 && !gqlIdentifiers.has(root)) {
              references.add(root);
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
      // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
      node.statements?.forEach((statement: any) => {
        visit(statement, exclusions);
      });
      return;
    }

    if (node.type === "CallExpression") {
      visit(node.callee, exclusions);
      // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
      node.arguments?.forEach((arg: any) => {
        visit(arg.expression ?? arg, exclusions);
      });
      return;
    }

    if (node.type === "StringLiteral" || node.type === "NumericLiteral" || node.type === "BooleanLiteral") {
      return;
    }

    if (node.type === "ArrayExpression") {
      // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
      node.elements?.forEach((element: any) => {
        if (element?.expression) {
          visit(element.expression, exclusions);
        }
      });
      return;
    }

    if (node.type === "ObjectExpression") {
      // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
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
      // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
      node.expressions?.forEach((expr: any) => {
        visit(expr, exclusions);
      });
      return;
    }

    if (node.type === "AssignmentExpression") {
      visit(node.left, exclusions);
      visit(node.right, exclusions);
      return;
    }

    Object.values(node).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((child) => {
          visit(child, exclusions);
        });
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
  source: string,
): {
  readonly definitions: ModuleDefinition[];
  readonly handledCalls: Set<CallExpression>;
} => {
  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const getPropertyName = (property: any): string | null => {
    if (!property) {
      return null;
    }
    if (property.type === "Identifier") {
      return property.value;
    }
    if (property.type === "StringLiteral" || property.type === "NumericLiteral") {
      return property.value;
    }
    return null;
  };

  type Pending = {
    readonly exportName: string;
    readonly kind: GqlDefinitionKind;
    readonly schemaName?: string;
    readonly initializer: CallExpression;
    readonly span: Span;
    readonly expression: string;
  };

  const pending: Pending[] = [];
  const handled = new Set<CallExpression>();

  const expressionFromCall = (call: CallExpression): string => {
    let start = call.span.start;
    // Adjust when span starts one character after the leading "g"
    if (start > 0 && source[start] === "q" && source[start - 1] === "g" && source.slice(start, start + 3) === "ql.") {
      start -= 1;
    }

    const raw = source.slice(start, call.span.end);
    const marker = raw.indexOf("gql");
    if (marker >= 0) {
      return raw.slice(marker);
    }
    return raw;
  };

  const register = (exportName: string, initializer: CallExpression, span: Span, kind: GqlDefinitionKind, schemaName?: string) => {
    handled.add(initializer);
    const expression = expressionFromCall(initializer);
    pending.push({
      exportName,
      initializer,
      span,
      kind,
      schemaName,
      expression,
    });
  };

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const handleVariableDeclaration = (declaration: any) => {
    // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
    declaration.declarations?.forEach((decl: any) => {
      if (decl.id.type !== "Identifier" || !decl.init) {
        return;
      }

      const baseName = decl.id.value;

      if (decl.init.type === "CallExpression") {
        const gqlCall = isGqlCall(gqlIdentifiers, decl.init);
        if (!gqlCall) {
          return;
        }
        register(
          baseName,
          decl.init,
          decl.span ?? decl.init.span,
          unwrapNullish(gqlCallKinds[gqlCall.method], "validated-map-lookup"),
          gqlCall.schemaName,
        );
        return;
      }

      if (decl.init.type === "ObjectExpression") {
        // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
        decl.init.properties?.forEach((prop: any) => {
          if (prop.type !== "KeyValueProperty") {
            return;
          }
          const name = getPropertyName(prop.key);
          if (!name || prop.value.type !== "CallExpression") {
            return;
          }
          const gqlCall = isGqlCall(gqlIdentifiers, prop.value);
          if (!gqlCall) {
            return;
          }
          register(
            `${baseName}.${name}`,
            prop.value,
            prop.value.span ?? prop.span ?? decl.span,
            unwrapNullish(gqlCallKinds[gqlCall.method], "validated-map-lookup"),
            gqlCall.schemaName,
          );
        });
      }
    });
  };

  module.body.forEach((item) => {
    if (item.type === "ExportDeclaration" && item.declaration.type === "VariableDeclaration") {
      handleVariableDeclaration(item.declaration);
      return;
    }

    if (
      item.type === "ExportNamedDeclaration" &&
      "declaration" in item &&
      item.declaration &&
      // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
      (item.declaration as any).type === "VariableDeclaration"
    ) {
      handleVariableDeclaration(item.declaration as VariableDeclaration);
      return;
    }

    if ("declaration" in item && item.declaration) {
      // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
      const declaration = item.declaration as any;
      if (
        declaration.type === "ExportDeclaration" &&
        declaration.declaration &&
        declaration.declaration.type === "VariableDeclaration"
      ) {
        handleVariableDeclaration(declaration.declaration as VariableDeclaration);
      }
      if (
        declaration.type === "ExportNamedDeclaration" &&
        declaration.declaration &&
        declaration.declaration.type === "VariableDeclaration"
      ) {
        handleVariableDeclaration(declaration.declaration);
      }
    }
  });

  const definitionNames = new Set(pending.map((item) => item.exportName));
  const definitions = pending.map(
    (item) =>
      ({
        kind: item.kind,
        exportName: item.exportName,
        schemaName: item.schemaName,
        loc: toLocation(resolvePosition, item.span),
        references: Array.from(collectReferencesFromExpression(item.initializer, imports, definitionNames, gqlIdentifiers)),
        expression: item.expression,
      }) satisfies ModuleDefinition,
  );

  return { definitions, handledCalls: handled };
};

const collectDiagnostics = (
  module: Module,
  gqlIdentifiers: ReadonlySet<string>,
  handled: ReadonlySet<CallExpression>,
  resolvePosition: (offset: number) => SourcePosition,
): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
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

  module.body.forEach((item) => {
    visit(item);
  });
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
  const collected = collectTopLevelDefinitions(module, gqlIdentifiers, imports, resolvePosition, source);
  let { definitions } = collected;
  const diagnostics = collectDiagnostics(module, gqlIdentifiers, collected.handledCalls, resolvePosition);

  const needsFallback = (expression: string | undefined): boolean => {
    if (!expression) {
      return true;
    }

    const trimmed = expression.trim();
    if (trimmed.length === 0) {
      return true;
    }

    return !trimmed.startsWith("gql");
  };

  if (definitions.some((definition) => needsFallback(definition.expression))) {
    const fallback = analyzeModuleTs({ filePath, source });
    const fallbackExpressions = new Map<string, string>();
    fallback.definitions.forEach((definition) => {
      fallbackExpressions.set(definition.exportName, definition.expression);
    });

    definitions = definitions.map((definition) => {
      if (!needsFallback(definition.expression)) {
        return definition;
      }

      const replacement = fallbackExpressions.get(definition.exportName) ?? "";
      return {
        ...definition,
        expression: replacement,
      } satisfies ModuleDefinition;
    });
  }

  return {
    filePath,
    sourceHash: Bun.hash(source).toString(16),
    definitions,
    diagnostics,
    imports,
    exports,
  } satisfies ModuleAnalysis;
};
