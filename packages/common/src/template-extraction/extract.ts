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
import type { ArrowFunctionExpression, CallExpression, MemberExpression, Node, TaggedTemplateExpression } from "@swc/types";
import type { SwcSpanConverter } from "../utils/swc-span";
import type { ExtractedTemplate, OperationKind } from "./types";

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
 * Extract templates from a gql callback's arrow function body.
 * Handles both expression bodies and block bodies with return statements.
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

    // Metadata chaining: query("Name")`...`({ metadata: {} })
    if (expr.type === "CallExpression") {
      const call = expr as unknown as CallExpression;
      if (call.callee.type === "TaggedTemplateExpression") {
        extractFromTaggedTemplate(call.callee as TaggedTemplateExpression, schemaName, templates, positionCtx);
      }
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
export const walkAndExtract = (
  node: Node,
  identifiers: ReadonlySet<string>,
  positionCtx?: PositionTrackingContext,
): ExtractedTemplate[] => {
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
};
