/**
 * SWC adapter for the analyzer core.
 * Implements parser-specific logic using the SWC parser.
 */

import { unwrapNullish } from "@soda-gql/tool-utils";
import { parseSync } from "@swc/core";
import type { CallExpression, ImportDeclaration, Module, Span, VariableDeclaration } from "@swc/types";

import type { AnalyzerAdapter } from "../analyzer-core";
import type {
  AnalyzeModuleInput,
  ModuleDefinition,
  ModuleDiagnostic,
  ModuleExport,
  ModuleImport,
  SourceLocation,
  SourcePosition,
} from "../analyzer-types";

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

const isGqlCall = (identifiers: ReadonlySet<string>, call: CallExpression): boolean => {
  const callee = call.callee;
  if (callee.type !== "MemberExpression") {
    return false;
  }

  if (callee.object.type !== "Identifier") {
    return false;
  }

  if (!identifiers.has(callee.object.value)) {
    return false;
  }

  if (callee.property.type !== "Identifier") {
    return false;
  }

  const firstArg = call.arguments[0];
  if (!firstArg?.expression || firstArg.expression.type !== "ArrowFunctionExpression") {
    return false;
  }

  return true;
};

const collectTopLevelDefinitions = (
  module: Module,
  gqlIdentifiers: ReadonlySet<string>,
  _imports: readonly ModuleImport[],
  resolvePosition: (offset: number) => SourcePosition,
  source: string,
): {
  readonly definitions: ModuleDefinition[];
  readonly handledCalls: readonly CallExpression[];
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
    readonly initializer: CallExpression;
    readonly span: Span;
    readonly expression: string;
  };

  const pending: Pending[] = [];
  const handled: CallExpression[] = [];

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

  const register = (exportName: string, initializer: CallExpression, span: Span) => {
    handled.push(initializer);
    const expression = expressionFromCall(initializer);
    pending.push({
      exportName,
      initializer,
      span,
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
        if (!isGqlCall(gqlIdentifiers, decl.init)) {
          return;
        }
        register(baseName, decl.init, decl.span ?? decl.init.span);
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
          if (!isGqlCall(gqlIdentifiers, prop.value)) {
            return;
          }
          register(`${baseName}.${name}`, prop.value, prop.value.span ?? prop.span ?? decl.span);
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

  const definitions = pending.map(
    (item) =>
      ({
        exportName: item.exportName,
        // TODO: Implement full AST path generation like TypeScript adapter
        astPath: item.exportName,
        // TODO: Currently only collecting top-level exported definitions
        isTopLevel: true,
        isExported: true,
        exportBinding: item.exportName,
        loc: toLocation(resolvePosition, item.span),
        expression: item.expression,
      }) satisfies ModuleDefinition,
  );

  return { definitions, handledCalls: handled };
};

const collectDiagnostics = (
  module: Module,
  gqlIdentifiers: ReadonlySet<string>,
  handled: readonly CallExpression[],
  resolvePosition: (offset: number) => SourcePosition,
): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];
  const handledSet = new Set(handled);

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const visit = (node: any) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.type === "CallExpression") {
      if (!handledSet.has(node)) {
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

/**
 * SWC adapter implementation
 */
export const swcAdapter: AnalyzerAdapter<Module, CallExpression> = {
  parse(input: AnalyzeModuleInput): Module | null {
    const program = parseSync(input.source, {
      syntax: "typescript",
      tsx: input.filePath.endsWith(".tsx"),
      target: "es2022",
      decorators: false,
      dynamicImport: true,
    });

    if (program.type !== "Module") {
      return null;
    }

    return program as Module;
  },

  collectGqlIdentifiers(file: Module): ReadonlySet<string> {
    return collectGqlIdentifiers(file);
  },

  collectImports(file: Module): readonly ModuleImport[] {
    return collectImports(file);
  },

  collectExports(file: Module): readonly ModuleExport[] {
    return collectExports(file);
  },

  collectDefinitions(
    file: Module,
    context: {
      readonly gqlIdentifiers: ReadonlySet<string>;
      readonly imports: readonly ModuleImport[];
      readonly exports: readonly ModuleExport[];
      readonly source: string;
    },
  ): {
    readonly definitions: readonly ModuleDefinition[];
    readonly handles: readonly CallExpression[];
  } {
    const resolvePosition = toPositionResolver(context.source);
    // TODO: Use exports to determine isExported like TypeScript adapter
    const { definitions, handledCalls } = collectTopLevelDefinitions(
      file,
      context.gqlIdentifiers,
      context.imports,
      resolvePosition,
      context.source,
    );
    return { definitions, handles: handledCalls };
  },

  collectDiagnostics(
    file: Module,
    context: {
      readonly gqlIdentifiers: ReadonlySet<string>;
      readonly handledCalls: readonly CallExpression[];
      readonly source: string;
    },
  ): readonly ModuleDiagnostic[] {
    const resolvePosition = toPositionResolver(context.source);
    return collectDiagnostics(file, context.gqlIdentifiers, context.handledCalls, resolvePosition);
  },
};
