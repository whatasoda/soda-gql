/**
 * SWC adapter for the analyzer core.
 * Implements parser-specific logic using the SWC parser.
 */

import { unwrapNullish } from "@soda-gql/tool-utils";
import { parseSync } from "@swc/core";
import type { CallExpression, ImportDeclaration, Module, Span } from "@swc/types";
import { createCanonicalTracker } from "../../canonical-id/path-tracker";
import { createExportBindingsMap, type ScopeFrame } from "../common/scope";
import type { AnalyzerAdapter } from "../core";

/**
 * Extended SWC Module with filePath attached (similar to ts.SourceFile.fileName)
 */
type SwcModule = Module & { __filePath: string };

import type {
  AnalyzeModuleInput,
  ModuleDefinition,
  ModuleDiagnostic,
  ModuleExport,
  ModuleImport,
  SourceLocation,
  SourcePosition,
} from "../types";

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
      return;
    }

    if (declaration.type === "ExportDefaultDeclaration" || declaration.type === "ExportDefaultExpression") {
      exports.push({
        kind: "named",
        exported: "default",
        local: "default",
        isTypeOnly: false,
      });
    }
  };

  module.body.forEach((item) => {
    if (
      item.type === "ExportDeclaration" ||
      item.type === "ExportNamedDeclaration" ||
      item.type === "ExportAllDeclaration" ||
      item.type === "ExportDefaultDeclaration" ||
      item.type === "ExportDefaultExpression"
    ) {
      handle(item);
      return;
    }

    if ("declaration" in item && item.declaration) {
      // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
      const declaration = item.declaration as any;
      if (
        declaration.type === "ExportDeclaration" ||
        declaration.type === "ExportNamedDeclaration" ||
        declaration.type === "ExportAllDeclaration" ||
        declaration.type === "ExportDefaultDeclaration" ||
        declaration.type === "ExportDefaultExpression"
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

const collectAllDefinitions = (
  module: SwcModule,
  gqlIdentifiers: ReadonlySet<string>,
  _imports: readonly ModuleImport[],
  exports: readonly ModuleExport[],
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

  type PendingDefinition = {
    readonly astPath: string;
    readonly isTopLevel: boolean;
    readonly isExported: boolean;
    readonly exportBinding?: string;
    readonly loc: SourceLocation;
    readonly expression: string;
  };

  const pending: PendingDefinition[] = [];
  const handledCalls: CallExpression[] = [];

  // Build export bindings map (which variables are exported and with what name)
  const exportBindings = createExportBindingsMap(exports);

  // Create canonical tracker
  const tracker = createCanonicalTracker({
    filePath: module.__filePath,
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

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const visit = (node: any, stack: ScopeFrame[]) => {
    if (!node || typeof node !== "object") {
      return;
    }

    // Check if this is a gql definition call
    if (node.type === "CallExpression" && isGqlCall(gqlIdentifiers, node)) {
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
        loc: toLocation(resolvePosition, node.span),
        expression: expressionFromCall(node),
      });

      // Don't visit children of gql calls
      return;
    }

    // Variable declaration
    if (node.type === "VariableDeclaration") {
      // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
      node.declarations?.forEach((decl: any) => {
        if (decl.id?.type === "Identifier") {
          const varName = decl.id.value;

          if (decl.init) {
            withScope(stack, varName, "variable", `var:${varName}`, (newStack) => {
              visit(decl.init, newStack);
            });
          }
        }
      });
      return;
    }

    // Function declaration
    if (node.type === "FunctionDeclaration") {
      const funcName = node.identifier?.value ?? getAnonymousName("function");

      if (node.body) {
        withScope(stack, funcName, "function", `func:${funcName}`, (newStack) => {
          visit(node.body, newStack);
        });
      }
      return;
    }

    // Arrow function
    if (node.type === "ArrowFunctionExpression") {
      const arrowName = getAnonymousName("arrow");

      if (node.body) {
        withScope(stack, arrowName, "function", "arrow", (newStack) => {
          visit(node.body, newStack);
        });
      }
      return;
    }

    // Function expression
    if (node.type === "FunctionExpression") {
      const funcName = node.identifier?.value ?? getAnonymousName("function");

      if (node.body) {
        withScope(stack, funcName, "function", `func:${funcName}`, (newStack) => {
          visit(node.body, newStack);
        });
      }
      return;
    }

    // Class declaration
    if (node.type === "ClassDeclaration") {
      const className = node.identifier?.value ?? getAnonymousName("class");

      withScope(stack, className, "class", `class:${className}`, (classStack) => {
        // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
        node.body?.forEach((member: any) => {
          if (member.type === "MethodProperty" || member.type === "ClassProperty") {
            const memberName = member.key?.value ?? null;
            if (memberName) {
              const memberKind = member.type === "MethodProperty" ? "method" : "property";
              withScope(classStack, memberName, memberKind, `member:${className}.${memberName}`, (memberStack) => {
                if (member.type === "MethodProperty" && member.body) {
                  visit(member.body, memberStack);
                } else if (member.type === "ClassProperty" && member.value) {
                  visit(member.value, memberStack);
                }
              });
            }
          }
        });
      });
      return;
    }

    // Object literal property
    if (node.type === "KeyValueProperty") {
      const propName = getPropertyName(node.key);
      if (propName) {
        withScope(stack, propName, "property", `prop:${propName}`, (newStack) => {
          visit(node.value, newStack);
        });
      }
      return;
    }

    // Recursively visit children
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child, stack);
      }
    } else {
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value) {
            visit(child, stack);
          }
        } else if (value && typeof value === "object") {
          visit(value, stack);
        }
      }
    }
  };

  // Start traversal from top-level statements
  module.body.forEach((statement) => {
    visit(statement, []);
  });

  const definitions = pending.map(
    (item) =>
      ({
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
const collectDiagnostics = (): ModuleDiagnostic[] => {
  // No longer emit NON_TOP_LEVEL_DEFINITION diagnostics
  // All gql definitions are now supported
  return [];
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

    // Attach filePath to module (similar to ts.SourceFile.fileName)
    const swcModule = program as SwcModule;
    swcModule.__filePath = input.filePath;
    return swcModule;
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
    const { definitions, handledCalls } = collectAllDefinitions(
      file as SwcModule,
      context.gqlIdentifiers,
      context.imports,
      context.exports,
      resolvePosition,
      context.source,
    );
    return { definitions, handles: handledCalls };
  },

  collectDiagnostics(
    _file: Module,
    _context: {
      readonly gqlIdentifiers: ReadonlySet<string>;
      readonly handledCalls: readonly CallExpression[];
      readonly source: string;
    },
  ): readonly ModuleDiagnostic[] {
    return collectDiagnostics();
  },
};
