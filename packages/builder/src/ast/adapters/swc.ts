/**
 * SWC adapter for the analyzer core.
 * Implements parser-specific logic using the SWC parser.
 */

import { createCanonicalId, createCanonicalTracker } from "@soda-gql/common";
import { parseSync } from "@swc/core";
import type { CallExpression, ImportDeclaration, Module } from "@swc/types";
import type { GraphqlSystemIdentifyHelper } from "../../internal/graphql-system";
import { createExportBindingsMap, type ScopeFrame } from "../common/scope";
import type { AnalyzerAdapter, AnalyzerResult } from "../core";

/**
 * Extended SWC Module with filePath attached (similar to ts.SourceFile.fileName)
 */
type SwcModule = Module & {
  __filePath: string;
  /** Offset to subtract from spans to normalize to 0-based source indices */
  __spanOffset: number;
};

import type { AnalyzeModuleInput, ModuleDefinition, ModuleExport, ModuleImport } from "../types";

const collectImports = (module: Module): ModuleImport[] => {
  const imports: ModuleImport[] = [];

  const handle = (declaration: ImportDeclaration) => {
    const source = declaration.source.value;
    // biome-ignore lint/suspicious/noExplicitAny: SWC types are not fully compatible
    declaration.specifiers?.forEach((specifier: any) => {
      if (specifier.type === "ImportSpecifier") {
        imports.push({
          source,
          local: specifier.local.value,
          kind: "named",
          isTypeOnly: Boolean(specifier.isTypeOnly),
        });
        return;
      }
      if (specifier.type === "ImportNamespaceSpecifier") {
        imports.push({
          source,
          local: specifier.local.value,
          kind: "namespace",
          isTypeOnly: false,
        });
        return;
      }
      if (specifier.type === "ImportDefaultSpecifier") {
        imports.push({
          source,
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

const collectGqlIdentifiers = (module: SwcModule, helper: GraphqlSystemIdentifyHelper): ReadonlySet<string> => {
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
    if (!helper.isGraphqlSystemImportSpecifier({ filePath: module.__filePath, specifier: declaration.source.value })) {
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

const collectAllDefinitions = ({
  module,
  gqlIdentifiers,
  imports: _imports,
  exports,
  source,
}: {
  module: SwcModule;
  gqlIdentifiers: ReadonlySet<string>;
  imports: readonly ModuleImport[];
  exports: readonly ModuleExport[];
  source: string;
}): {
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
    // Normalize span by subtracting the module's span offset
    const spanOffset = module.__spanOffset;
    let start = call.span.start - spanOffset;
    const end = call.span.end - spanOffset;

    // Adjust when span starts one character after the leading "g"
    if (start > 0 && source[start] === "q" && source[start - 1] === "g" && source.slice(start, start + 3) === "ql.") {
      start -= 1;
    }

    const raw = source.slice(start, end);
    const marker = raw.indexOf("gql");
    const expression = marker >= 0 ? raw.slice(marker) : raw;

    // Strip trailing semicolons and whitespace that SWC may include in the span
    // TypeScript's node.getText() doesn't include these, so we normalize to match
    return expression.replace(/\s*;\s*$/, "");
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
          if (member.type === "ClassMethod" || member.type === "ClassProperty") {
            const memberName = member.key?.value ?? null;
            if (memberName) {
              const memberKind = member.type === "ClassMethod" ? "method" : "property";
              withScope(classStack, memberName, memberKind, `member:${className}.${memberName}`, (memberStack) => {
                if (member.type === "ClassMethod" && member.function?.body) {
                  visit(member.function.body, memberStack);
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
        canonicalId: createCanonicalId(module.__filePath, item.astPath),
        astPath: item.astPath,
        isTopLevel: item.isTopLevel,
        isExported: item.isExported,
        exportBinding: item.exportBinding,
        expression: item.expression,
      }) satisfies ModuleDefinition,
  );

  return { definitions, handledCalls };
};

/**
 * SWC adapter implementation.
 * The analyze method parses and collects all data in one pass,
 * ensuring the AST (Module) is released after analysis.
 */
export const swcAdapter: AnalyzerAdapter = {
  analyze(input: AnalyzeModuleInput, helper: GraphqlSystemIdentifyHelper): AnalyzerResult | null {
    // Parse source - AST is local to this function
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

    // SWC's BytePos counter accumulates across parseSync calls within the same process.
    // To convert span positions to 0-indexed source positions, we compute the accumulated
    // offset from previous parses: (program.span.end - source.length) gives us the total
    // bytes from previously parsed files, and we add 1 because spans are 1-indexed.
    const spanOffset = (program.span.end - input.source.length) + 1;

    // Attach filePath to module (similar to ts.SourceFile.fileName)
    const swcModule = program as SwcModule;
    swcModule.__filePath = input.filePath;
    swcModule.__spanOffset = spanOffset;

    // Collect all data in one pass
    const gqlIdentifiers = collectGqlIdentifiers(swcModule, helper);
    const imports = collectImports(swcModule);
    const exports = collectExports(swcModule);

    const { definitions } = collectAllDefinitions({
      module: swcModule,
      gqlIdentifiers,
      imports,
      exports,
      source: input.source,
    });

    // Return results - swcModule goes out of scope and becomes eligible for GC
    return {
      imports,
      exports,
      definitions,
    };
  },
};
