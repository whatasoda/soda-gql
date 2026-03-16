/**
 * Template extraction from TypeScript source using SWC AST.
 *
 * Based on the typegen extractor (superset): supports both bare-tag
 * (`query\`...\``) and curried (`query("Name")\`...\``) syntax.
 *
 * Position tracking is optional — pass spanOffset + converter to
 * populate contentRange on extracted templates.
 *
 * @module
 */

// Re-export for convenience — SWC types are type-only imports
import type {
  ArrowFunctionExpression,
  CallExpression,
  MemberExpression,
  Node,
  ObjectExpression,
  TaggedTemplateExpression,
} from "@swc/types";
import type { SwcSpanConverter } from "../utils/swc-span";
import type { ExtractedTemplate, ExtractedTemplateWithPosition, OperationKind } from "./types";

export const OPERATION_KINDS = new Set<string>(["query", "mutation", "subscription", "fragment"]);

export const isOperationKind = (value: string): value is OperationKind => OPERATION_KINDS.has(value);

/** Optional position tracking context for extraction. */
export type PositionTrackingContext = {
  readonly spanOffset: number;
  readonly converter: SwcSpanConverter;
};

/**
 * Check if a call expression is a gql.{schemaName}(...) call.
 * Returns the schema name if it is, null otherwise.
 */
export const getGqlCallSchemaName = (identifiers: ReadonlySet<string>, call: CallExpression): string | null => {
  const callee = call.callee;
  if (callee.type !== "MemberExpression") {
    return null;
  }

  const member = callee as MemberExpression;
  if (member.object.type !== "Identifier" || !identifiers.has(member.object.value)) {
    return null;
  }

  if (member.property.type !== "Identifier") {
    return null;
  }

  const firstArg = call.arguments[0];
  if (!firstArg?.expression || firstArg.expression.type !== "ArrowFunctionExpression") {
    return null;
  }

  return member.property.value;
};

/**
 * Find the curried name call (e.g., `query("Name")`) from a callback builder expression.
 * Unwraps trailing call expressions like `({})` or `({ metadata: ... })`.
 *
 * Returns `{ curriedCall, configCall }` where:
 * - curriedCall: the `query("Name")` CallExpression
 * - configCall: the `({ variables, fields })` CallExpression
 *
 * Returns null if the expression doesn't match the callback builder pattern.
 */
const findCallbackBuilderCalls = (
  expr: Node,
): { curriedCall: CallExpression; configCall: CallExpression } | null => {
  if (expr.type !== "CallExpression") return null;
  let call = expr as unknown as CallExpression;

  // Unwrap trailing call: query("Name")({ ... })({}) → get to query("Name")({ ... })
  // The trailing call's callee is the config call, whose callee is the curried name call.
  // We need to find the config call that has an ObjectExpression argument
  // and whose callee is a curried name call (CallExpression with Identifier callee).

  // Try current level as config call first (no trailing call case)
  if (call.callee.type === "CallExpression") {
    const maybeConfigCall = call;
    const maybeCurriedCall = call.callee as CallExpression;

    // Check if maybeCurriedCall is a curried name call: query("Name")
    if (maybeCurriedCall.callee.type === "Identifier" && isOperationKind(maybeCurriedCall.callee.value)) {
      // This is: curriedCall({ ... }) — no trailing call, expr IS the config call
      const configArg = maybeConfigCall.arguments[0]?.expression;
      if (configArg?.type === "ObjectExpression") {
        return { curriedCall: maybeCurriedCall, configCall: maybeConfigCall };
      }
    }

    // Check if maybeCurriedCall is the config call (trailing call case)
    // expr is: trailing({}) where trailing.callee = configCall
    if (maybeCurriedCall.callee.type === "CallExpression") {
      const innerCurriedCall = maybeCurriedCall.callee as CallExpression;
      if (innerCurriedCall.callee.type === "Identifier" && isOperationKind(innerCurriedCall.callee.value)) {
        const configArg = maybeCurriedCall.arguments[0]?.expression;
        if (configArg?.type === "ObjectExpression") {
          return { curriedCall: innerCurriedCall, configCall: maybeCurriedCall };
        }
      }
    }
  }

  return null;
};

/**
 * Extract variables template from a callback builder options object.
 * Handles patterns like:
 * - `query("Name")({ variables: \`($id: ID!)\`, fields: ... })({})`
 * - `query("Name")({ variables: "($id: ID!)", fields: ... })`
 *
 * Returns true if a callback builder pattern was detected (even if no variables property found).
 */
export const extractVariablesFromCallbackBuilder = (
  expr: Node,
  schemaName: string,
  templates: ExtractedTemplate[],
  positionCtx?: PositionTrackingContext,
): boolean => {
  const result = findCallbackBuilderCalls(expr);
  if (!result) return false;

  const { curriedCall, configCall } = result;

  // Extract elementName from curried call
  const nameArg = curriedCall.arguments[0]?.expression;
  const elementName = nameArg?.type === "StringLiteral" ? (nameArg as { value: string }).value : undefined;

  // Extract kind from curried call
  const kind = (curriedCall.callee as { value: string }).value;

  // Find variables property in config object
  const configObj = configCall.arguments[0]?.expression as ObjectExpression;
  for (const prop of configObj.properties) {
    if (prop.type !== "KeyValueProperty") continue;
    if (prop.key.type !== "Identifier" || (prop.key as { value: string }).value !== "variables") continue;

    const value = prop.value;
    let content: string | undefined;
    let contentStart = -1;
    let contentEnd = -1;

    if (value.type === "TemplateLiteral") {
      // Template literal: `($id: ID!)`
      const tpl = value as unknown as { quasis: { raw: string; cooked?: string; span: { start: number; end: number } }[] };
      if (tpl.quasis.length > 0) {
        content = tpl.quasis[0]!.cooked ?? tpl.quasis[0]!.raw;
        if (positionCtx) {
          contentStart = positionCtx.converter.byteOffsetToCharIndex(tpl.quasis[0]!.span.start - positionCtx.spanOffset);
          contentEnd = positionCtx.converter.byteOffsetToCharIndex(tpl.quasis[0]!.span.end - positionCtx.spanOffset);
        }
      }
    } else if (value.type === "StringLiteral") {
      // StringLiteral span is in byte space and includes quote delimiters.
      // Adjust in byte space before byteOffsetToCharIndex conversion.
      // Safe because quote characters (", ') are ASCII (1 byte in UTF-8).
      const strLit = value as unknown as { value: string; span: { start: number; end: number } };
      content = strLit.value;
      if (positionCtx) {
        contentStart = positionCtx.converter.byteOffsetToCharIndex(strLit.span.start + 1 - positionCtx.spanOffset);
        contentEnd = positionCtx.converter.byteOffsetToCharIndex(strLit.span.end - 1 - positionCtx.spanOffset);
      }
    }

    if (content !== undefined) {
      templates.push({
        schemaName,
        kind: kind as OperationKind,
        content,
        source: "callback-variables",
        ...(elementName !== undefined ? { elementName } : {}),
        ...(positionCtx && contentStart !== -1 && contentEnd !== -1
          ? { contentRange: { start: contentStart, end: contentEnd } }
          : {}),
      });
    }

    break;
  }

  return true;
};

/**
 * Extract templates from a gql callback's arrow function body.
 * Handles tagged templates, metadata chaining, and callback builder variables.
 */
export const extractTemplatesFromCallback = (
  arrow: ArrowFunctionExpression,
  schemaName: string,
  positionCtx?: PositionTrackingContext,
): ExtractedTemplate[] => {
  const templates: ExtractedTemplate[] = [];

  const processExpression = (expr: Node): void => {
    // Direct tagged template: query("Name")`...`
    if (expr.type === "TaggedTemplateExpression") {
      const tagged = expr as unknown as TaggedTemplateExpression;
      extractFromTaggedTemplate(tagged, schemaName, templates, positionCtx);
      return;
    }

    // CallExpression paths: metadata chaining or callback builder
    if (expr.type === "CallExpression") {
      const call = expr as unknown as CallExpression;

      // Metadata chaining: query("Name")`...`({ metadata: {} })
      if (call.callee.type === "TaggedTemplateExpression") {
        extractFromTaggedTemplate(call.callee as TaggedTemplateExpression, schemaName, templates, positionCtx);
        return;
      }

      // Callback builder: query("Name")({ variables: `...`, fields: ... })({})
      extractVariablesFromCallbackBuilder(expr, schemaName, templates, positionCtx);
    }
  };

  // Expression body: ({ query }) => query("Name")`...`
  if (arrow.body.type !== "BlockStatement") {
    processExpression(arrow.body);
    return templates;
  }

  // Block body: ({ query }) => { return query("Name")`...`; }
  for (const stmt of arrow.body.stmts) {
    if (stmt.type === "ReturnStatement" && stmt.argument) {
      processExpression(stmt.argument);
    }
  }

  return templates;
};

/**
 * Extract a single template from a tagged template expression.
 * Supports both bare-tag (Identifier) and curried (CallExpression) tag forms.
 */
export const extractFromTaggedTemplate = (
  tagged: TaggedTemplateExpression,
  schemaName: string,
  templates: ExtractedTemplate[],
  positionCtx?: PositionTrackingContext,
): void => {
  // Tag can be:
  // - CallExpression: query("name")`...` or fragment("name", "type")`...` (curried syntax)
  // - Identifier: legacy bare-tag form (skipped if it contains interpolations)
  let kind: string;
  let elementName: string | undefined;
  let typeName: string | undefined;

  if (tagged.tag.type === "Identifier") {
    kind = tagged.tag.value;
  } else if (tagged.tag.type === "CallExpression") {
    const tagCall = tagged.tag as CallExpression;
    if (tagCall.callee.type === "Identifier") {
      kind = tagCall.callee.value;
    } else {
      return;
    }
    // Extract elementName and typeName from call arguments
    const firstArg = tagCall.arguments[0]?.expression;
    if (firstArg?.type === "StringLiteral") {
      elementName = (firstArg as { value: string }).value;
    }
    const secondArg = tagCall.arguments[1]?.expression;
    if (secondArg?.type === "StringLiteral") {
      typeName = (secondArg as { value: string }).value;
    }
  } else {
    return;
  }

  if (!isOperationKind(kind)) {
    return;
  }

  const { quasis, expressions } = tagged.template;

  // For legacy Identifier tag, skip templates with interpolations
  if (tagged.tag.type === "Identifier" && expressions.length > 0) {
    return;
  }

  if (quasis.length === 0) {
    return;
  }

  // Build content and optionally track position
  let contentStart = -1;
  let contentEnd = -1;
  const expressionRanges: { start: number; end: number }[] = [];

  const parts: string[] = [];
  for (let i = 0; i < quasis.length; i++) {
    const quasi = quasis[i];
    if (!quasi) continue;

    if (positionCtx) {
      const quasiStart = positionCtx.converter.byteOffsetToCharIndex(quasi.span.start - positionCtx.spanOffset);
      const quasiEnd = positionCtx.converter.byteOffsetToCharIndex(quasi.span.end - positionCtx.spanOffset);
      if (contentStart === -1) contentStart = quasiStart;
      contentEnd = quasiEnd;
    }

    parts.push(quasi.cooked ?? quasi.raw);
    if (i < expressions.length) {
      parts.push(`__FRAG_SPREAD_${i}__`);
      if (positionCtx) {
        // All SWC AST nodes have span; cast needed because Expression union type doesn't expose it uniformly
        const expr = expressions[i] as unknown as { span: { start: number; end: number } };
        const exprStart = positionCtx.converter.byteOffsetToCharIndex(expr.span.start - positionCtx.spanOffset);
        const exprEnd = positionCtx.converter.byteOffsetToCharIndex(expr.span.end - positionCtx.spanOffset);
        expressionRanges.push({ start: exprStart, end: exprEnd });
      }
    }
  }
  const content = parts.join("");

  const template: ExtractedTemplate = {
    schemaName,
    kind,
    content,
    ...(elementName !== undefined ? { elementName } : {}),
    ...(typeName !== undefined ? { typeName } : {}),
    ...(positionCtx && contentStart !== -1 && contentEnd !== -1
      ? { contentRange: { start: contentStart, end: contentEnd } }
      : {}),
    ...(expressionRanges.length > 0 ? { expressionRanges } : {}),
  };

  templates.push(template);
};

/**
 * Find the innermost gql call, unwrapping method chains like .attach().
 */
export const findGqlCall = (identifiers: ReadonlySet<string>, node: Node): CallExpression | null => {
  if (!node || node.type !== "CallExpression") {
    return null;
  }

  const call = node as unknown as CallExpression;
  if (getGqlCallSchemaName(identifiers, call) !== null) {
    return call;
  }

  const callee = call.callee;
  if (callee.type !== "MemberExpression") {
    return null;
  }

  return findGqlCall(identifiers, callee.object as unknown as Node);
};

/**
 * Walk AST to find gql calls and extract templates.
 */
export function walkAndExtract(
  node: Node,
  identifiers: ReadonlySet<string>,
  positionCtx: PositionTrackingContext,
): ExtractedTemplateWithPosition[];
export function walkAndExtract(
  node: Node,
  identifiers: ReadonlySet<string>,
  positionCtx?: PositionTrackingContext,
): ExtractedTemplate[];
export function walkAndExtract(
  node: Node,
  identifiers: ReadonlySet<string>,
  positionCtx?: PositionTrackingContext,
): ExtractedTemplate[] {
  const templates: ExtractedTemplate[] = [];

  const visit = (n: Node | ReadonlyArray<Node> | Record<string, unknown>): void => {
    if (!n || typeof n !== "object") {
      return;
    }

    if ("type" in n && n.type === "CallExpression") {
      const gqlCall = findGqlCall(identifiers, n as Node);
      if (gqlCall) {
        const schemaName = getGqlCallSchemaName(identifiers, gqlCall);
        if (schemaName) {
          const arrow = gqlCall.arguments[0]?.expression as ArrowFunctionExpression;
          templates.push(...extractTemplatesFromCallback(arrow, schemaName, positionCtx));
        }
        return; // Don't recurse into gql calls
      }
    }

    // Recurse into all array and object properties
    if (Array.isArray(n)) {
      for (const item of n) {
        visit(item as Node);
      }
      return;
    }

    for (const key of Object.keys(n)) {
      if (key === "span" || key === "type") {
        continue;
      }
      const value = (n as Record<string, unknown>)[key];
      if (value && typeof value === "object") {
        visit(value as Node);
      }
    }
  };

  visit(node);
  return templates;
}
