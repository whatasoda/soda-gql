/**
 * SWC adapter for the analyzer core.
 * Implements parser-specific logic using the SWC parser.
 */

import { createCanonicalId, createCanonicalTracker, createSwcSpanConverter, type ScopeHandle, type SwcSpanConverter } from "@soda-gql/common";
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
  /** Converter for UTF-8 byte offsets to UTF-16 char indices */
  __spanConverter: SwcSpanConverter;
};

import { createStandardDiagnostic } from "../common/detection";
import type {
  AnalyzeModuleInput,
  DiagnosticLocation,
  ModuleDefinition,
  ModuleDiagnostic,
  ModuleExport,
  ModuleImport,
} from "../types";

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
        // Only add non-renamed imports (imported exists when renamed: "gql as g")
        if (imported === "gql" && !specifier.imported) {
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

/**
 * Unwrap method chains (like .attach()) to find the underlying gql call.
 * Returns the innermost CallExpression that is a valid gql definition call.
 */
// biome-ignore lint/suspicious/noExplicitAny: SWC AST type
const unwrapMethodChains = (identifiers: ReadonlySet<string>, node: any): CallExpression | null => {
  if (!node || node.type !== "CallExpression") {
    return null;
  }

  // Check if this is directly a gql call
  if (isGqlCall(identifiers, node)) {
    return node;
  }

  // Check if this is a method call on another expression (e.g., .attach())
  const callee = node.callee;
  if (callee.type !== "MemberExpression") {
    return null;
  }

  // Recursively check the object of the member expression
  // e.g., for `gql.default(...).attach(...)`, callee.object is `gql.default(...)`
  return unwrapMethodChains(identifiers, callee.object);
};

const collectAllDefinitions = ({
  module,
  gqlIdentifiers,
  imports: _imports,
  exports,
  source,
  baseDir,
}: {
  module: SwcModule;
  gqlIdentifiers: ReadonlySet<string>;
  imports: readonly ModuleImport[];
  exports: readonly ModuleExport[];
  source: string;
  baseDir?: string;
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
    baseDir,
    getExportName: (localName) => exportBindings.get(localName),
  });

  // Anonymous scope counters (for naming only, not occurrence tracking)
  // Use underscore separator instead of # to ensure valid JavaScript identifiers
  const anonymousCounters = new Map<string, number>();
  const getAnonymousName = (kind: string): string => {
    const count = anonymousCounters.get(kind) ?? 0;
    anonymousCounters.set(kind, count + 1);
    return `_${kind}_${count}`;
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
    // Normalize span by subtracting the module's span offset, then convert byte→char
    const spanOffset = module.__spanOffset;
    const converter = module.__spanConverter;
    let start = converter.byteOffsetToCharIndex(call.span.start - spanOffset);
    const end = converter.byteOffsetToCharIndex(call.span.end - spanOffset);

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

  // Check if we're inside a class property (class property scope tracking is unreliable)
  const isInClassProperty = (stack: ScopeFrame[]): boolean =>
    stack.some((frame, i) => frame.kind === "property" && stack[i - 1]?.kind === "class");

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const visit = (node: any, stack: ScopeFrame[]) => {
    if (!node || typeof node !== "object") {
      return;
    }

    // Check if this is a gql definition call (possibly wrapped in method chains like .attach())
    if (node.type === "CallExpression") {
      const gqlCall = unwrapMethodChains(gqlIdentifiers, node);
      // Skip definition collection for gql calls inside class properties
      // (CLASS_PROPERTY diagnostic is still emitted by collectClassPropertyDiagnostics)
      if (gqlCall && !isInClassProperty(stack)) {
        // If scopeStack is empty (unbound gql call), enter an anonymous scope
        const needsAnonymousScope = tracker.currentDepth() === 0;
        let anonymousScopeHandle: ScopeHandle | undefined;

        if (needsAnonymousScope) {
          const anonymousName = getAnonymousName("anonymous");
          anonymousScopeHandle = tracker.enterScope({
            segment: anonymousName,
            kind: "expression",
            stableKey: "anonymous",
          });
        }

        try {
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
            // Use the unwrapped gql call expression (without .attach() chain)
            expression: expressionFromCall(gqlCall),
          });
        } finally {
          // Exit anonymous scope if we entered one
          if (anonymousScopeHandle) {
            tracker.exitScope(anonymousScopeHandle);
          }
        }

        // Don't visit children of gql calls
        return;
      }
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
        } else if (decl.init) {
          // Handle destructuring patterns (ObjectPattern, ArrayPattern)
          // Visit the initializer without entering a scope (anonymous gql calls will handle their own scope)
          visit(decl.init, stack);
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
        canonicalId: createCanonicalId(module.__filePath, item.astPath, { baseDir }),
        astPath: item.astPath,
        isTopLevel: item.isTopLevel,
        isExported: item.isExported,
        exportBinding: item.exportBinding,
        expression: item.expression,
      }) satisfies ModuleDefinition,
  );

  return { definitions, handledCalls };
};

// ============================================================================
// Diagnostic Collection
// ============================================================================

/**
 * Get location from an SWC node span
 */
const getLocation = (module: SwcModule, span: { start: number; end: number }): DiagnosticLocation => {
  const converter = module.__spanConverter;
  const start = converter.byteOffsetToCharIndex(span.start - module.__spanOffset);
  const end = converter.byteOffsetToCharIndex(span.end - module.__spanOffset);
  return { start, end };
};

/**
 * Collect diagnostics for invalid import patterns from graphql-system
 */
const collectImportDiagnostics = (module: SwcModule, helper: GraphqlSystemIdentifyHelper): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];

  module.body.forEach((item) => {
    const declaration =
      item.type === "ImportDeclaration"
        ? item
        : "declaration" in item &&
            item.declaration &&
            "type" in item.declaration &&
            // biome-ignore lint/suspicious/noExplicitAny: SWC type cast
            (item.declaration as any).type === "ImportDeclaration"
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
      // Check for default import
      if (specifier.type === "ImportDefaultSpecifier") {
        diagnostics.push(createStandardDiagnostic("DEFAULT_IMPORT", getLocation(module, specifier.span), undefined));
        return;
      }

      // Check for namespace import: import * as gqlSystem from "..."
      if (specifier.type === "ImportNamespaceSpecifier") {
        diagnostics.push(
          createStandardDiagnostic("STAR_IMPORT", getLocation(module, specifier.span), {
            namespaceAlias: specifier.local.value,
          }),
        );
        return;
      }

      // Check for renamed gql import: import { gql as g } from "..."
      if (specifier.type === "ImportSpecifier") {
        const imported = specifier.imported ? specifier.imported.value : specifier.local.value;
        // Only report if gql is renamed (imported exists and is "gql")
        if (imported === "gql" && specifier.imported) {
          diagnostics.push(
            createStandardDiagnostic("RENAMED_IMPORT", getLocation(module, specifier.span), {
              importedAs: specifier.local.value,
            }),
          );
        }
      }
    });
  });

  return diagnostics;
};

/**
 * Check if a node contains a reference to any gql identifier
 */
// biome-ignore lint/suspicious/noExplicitAny: SWC AST type
const containsGqlIdentifier = (node: any, identifiers: ReadonlySet<string>): boolean => {
  if (!node || typeof node !== "object") {
    return false;
  }
  if (node.type === "Identifier" && identifiers.has(node.value)) {
    return true;
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        if (containsGqlIdentifier(child, identifiers)) {
          return true;
        }
      }
    } else if (value && typeof value === "object") {
      if (containsGqlIdentifier(value, identifiers)) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Get the type name of an argument for error messages
 */
// biome-ignore lint/suspicious/noExplicitAny: SWC AST type
const getArgumentType = (node: any): string => {
  if (!node) return "undefined";
  switch (node.type) {
    case "StringLiteral":
      return "string";
    case "NumericLiteral":
      return "number";
    case "ObjectExpression":
      return "object";
    case "ArrayExpression":
      return "array";
    case "FunctionExpression":
      return "function";
    case "NullLiteral":
      return "null";
    case "BooleanLiteral":
      return "boolean";
    default:
      return "unknown";
  }
};

/**
 * Collect diagnostics for invalid gql call patterns
 */
const collectCallDiagnostics = (module: SwcModule, gqlIdentifiers: ReadonlySet<string>): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const visit = (node: any) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.type === "CallExpression") {
      const diagnostic = checkCallExpression(module, node, gqlIdentifiers);
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }

    // Recursively visit children
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          visit(child);
        }
      } else if (value && typeof value === "object") {
        visit(value);
      }
    }
  };

  module.body.forEach(visit);
  return diagnostics;
};

/**
 * Check a call expression for invalid gql patterns
 */
const checkCallExpression = (
  module: SwcModule,
  call: CallExpression,
  gqlIdentifiers: ReadonlySet<string>,
): ModuleDiagnostic | null => {
  const callee = call.callee;

  // Check for direct gql() call (non-member): gql(...)
  if (callee.type === "Identifier" && gqlIdentifiers.has(callee.value)) {
    return createStandardDiagnostic("NON_MEMBER_CALLEE", getLocation(module, call.span), undefined);
  }

  // Check for optional chaining: gql?.default(...)
  // SWC wraps optional chaining in OptionalChainingExpression
  if (callee.type === "OptionalChainingExpression") {
    // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
    const base = (callee as any).base;
    if (base?.type === "MemberExpression") {
      const object = base.object;
      if (object?.type === "Identifier" && gqlIdentifiers.has(object.value)) {
        return createStandardDiagnostic("OPTIONAL_CHAINING", getLocation(module, call.span), undefined);
      }
    }
    return null;
  }

  // Must be member expression for valid gql call
  if (callee.type !== "MemberExpression") {
    return null;
  }

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const object = (callee as any).object;
  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const property = (callee as any).property;

  // Check for computed access: gql["default"](...) or gql[variable](...)
  // SWC represents computed property access with property.type === "Computed"
  if (property?.type === "Computed" && object?.type === "Identifier" && gqlIdentifiers.has(object.value)) {
    return createStandardDiagnostic("COMPUTED_PROPERTY", getLocation(module, call.span), undefined);
  }

  // Check for dynamic callee: (x || gql).default(...)
  if (object?.type !== "Identifier") {
    if (containsGqlIdentifier(object, gqlIdentifiers)) {
      return createStandardDiagnostic("DYNAMIC_CALLEE", getLocation(module, call.span), undefined);
    }
    return null;
  }

  // Not a gql identifier - skip
  if (!gqlIdentifiers.has(object.value)) {
    return null;
  }

  // Check arguments for gql.schema(...) calls
  if (!call.arguments || call.arguments.length === 0) {
    return createStandardDiagnostic("MISSING_ARGUMENT", getLocation(module, call.span), undefined);
  }

  const firstArg = call.arguments[0];
  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const firstArgAny = firstArg as any;

  // Check for spread argument: gql.default(...args)
  if (firstArgAny?.spread) {
    return createStandardDiagnostic("SPREAD_ARGUMENT", getLocation(module, call.span), undefined);
  }

  const expression = firstArgAny?.expression;
  if (expression && expression.type !== "ArrowFunctionExpression") {
    const actualType = getArgumentType(expression);
    return createStandardDiagnostic("INVALID_ARGUMENT_TYPE", getLocation(module, call.span), { actualType });
  }

  // Check for extra arguments: gql.default(() => ..., extra)
  if (call.arguments.length > 1) {
    const extraCount = call.arguments.length - 1;
    return createStandardDiagnostic("EXTRA_ARGUMENTS", getLocation(module, call.span), {
      extraCount: String(extraCount),
    });
  }

  return null;
};

/**
 * Collect diagnostics for gql calls in class properties
 */
const collectClassPropertyDiagnostics = (module: SwcModule, gqlIdentifiers: ReadonlySet<string>): ModuleDiagnostic[] => {
  const diagnostics: ModuleDiagnostic[] = [];

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const containsGqlCall = (node: any): boolean => {
    if (!node || typeof node !== "object") {
      return false;
    }
    if (node.type === "CallExpression" && isGqlCall(gqlIdentifiers, node)) {
      return true;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          if (containsGqlCall(child)) {
            return true;
          }
        }
      } else if (value && typeof value === "object") {
        if (containsGqlCall(value)) {
          return true;
        }
      }
    }
    return false;
  };

  // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
  const visit = (node: any) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.type === "ClassDeclaration") {
      // biome-ignore lint/suspicious/noExplicitAny: SWC AST type
      node.body?.forEach((member: any) => {
        if (member.type === "ClassProperty" && member.value) {
          if (containsGqlCall(member.value)) {
            diagnostics.push(createStandardDiagnostic("CLASS_PROPERTY", getLocation(module, member.span), undefined));
          }
        }
      });
    }

    // Recursively visit children
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          visit(child);
        }
      } else if (value && typeof value === "object") {
        visit(value);
      }
    }
  };

  module.body.forEach(visit);
  return diagnostics;
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
    // Use UTF-8 byte length (not source.length which is UTF-16 code units) for correct offset.
    const converter = createSwcSpanConverter(input.source);
    const spanOffset = program.span.end - converter.byteLength + 1;

    // Attach filePath to module (similar to ts.SourceFile.fileName)
    const swcModule = program as SwcModule;
    swcModule.__filePath = input.filePath;
    swcModule.__spanOffset = spanOffset;
    swcModule.__spanConverter = converter;

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
      baseDir: input.baseDir,
    });

    // Collect diagnostics
    const diagnostics = [
      ...collectImportDiagnostics(swcModule, helper),
      ...collectCallDiagnostics(swcModule, gqlIdentifiers),
      ...collectClassPropertyDiagnostics(swcModule, gqlIdentifiers),
    ];

    // Return results - swcModule goes out of scope and becomes eligible for GC
    return {
      imports,
      exports,
      definitions,
      diagnostics,
    };
  },
};
