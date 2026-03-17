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
import type {
  ExtractedFieldTree,
  ExtractedTemplate,
  ExtractedTemplateWithPosition,
  FieldCallNested,
  FieldCallNode,
  OperationKind,
  UnionBranchNode,
} from "./types";

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
const findCallbackBuilderCalls = (expr: Node): { curriedCall: CallExpression; configCall: CallExpression } | null => {
  if (expr.type !== "CallExpression") return null;
  const call = expr as unknown as CallExpression;

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

/**
 * Walk AST to find gql callback builder calls and extract field call trees.
 * Companion to walkAndExtract — collects ExtractedFieldTree instead of ExtractedTemplate.
 */
export const walkAndExtractFieldTrees = (
  node: Node,
  identifiers: ReadonlySet<string>,
  positionCtx?: PositionTrackingContext,
): ExtractedFieldTree[] => {
  const trees: ExtractedFieldTree[] = [];

  const visit = (n: Node | ReadonlyArray<Node> | Record<string, unknown>): void => {
    if (!n || typeof n !== "object") return;

    if ("type" in n && n.type === "CallExpression") {
      const gqlCall = findGqlCall(identifiers, n as Node);
      if (gqlCall) {
        const schemaName = getGqlCallSchemaName(identifiers, gqlCall);
        if (schemaName) {
          const arrow = gqlCall.arguments[0]?.expression as ArrowFunctionExpression;
          // Process each expression in the arrow body for field trees
          const processExpr = (expr: Node): void => {
            if (expr.type === "CallExpression") {
              const tree = extractFieldCallTree(expr, schemaName, positionCtx);
              if (tree) trees.push(tree);
            }
          };
          if (arrow.body.type !== "BlockStatement") {
            processExpr(arrow.body as Node);
          } else {
            for (const stmt of arrow.body.stmts) {
              if (stmt.type === "ReturnStatement" && stmt.argument) {
                processExpr(stmt.argument as Node);
              }
            }
          }
        }
        return;
      }
    }

    if (Array.isArray(n)) {
      for (const item of n) visit(item as Node);
      return;
    }

    for (const key of Object.keys(n)) {
      if (key === "span" || key === "type") continue;
      const value = (n as Record<string, unknown>)[key];
      if (value && typeof value === "object") visit(value as Node);
    }
  };

  visit(node);
  return trees;
};

/**
 * Convert a byte-space span to a character-index span using a position context.
 * Used for tracking field name and call positions within a callback builder.
 */
const convertSpan = (
  span: { start: number; end: number },
  positionCtx: PositionTrackingContext,
): { start: number; end: number } => ({
  start: positionCtx.converter.byteOffsetToCharIndex(span.start - positionCtx.spanOffset),
  end: positionCtx.converter.byteOffsetToCharIndex(span.end - positionCtx.spanOffset),
});

/**
 * Walk an arrow function body to extract FieldCallNode children.
 * The arrow body should return an ObjectExpression where each property
 * is a SpreadElement wrapping an outer CallExpression:
 *   `({ f }) => ({ ...f("fieldName")(...) })`
 */
const extractFieldCallChildren = (
  arrow: ArrowFunctionExpression,
  positionCtx?: PositionTrackingContext,
): readonly FieldCallNode[] => {
  // Unwrap the body to get the ObjectExpression
  let bodyExpr: { type: string } | undefined;

  if (arrow.body.type === "BlockStatement") {
    for (const stmt of (arrow.body as { stmts: { type: string; argument?: { type: string } }[] }).stmts) {
      if (stmt.type === "ReturnStatement" && stmt.argument) {
        bodyExpr = stmt.argument as { type: string };
        break;
      }
    }
  } else {
    bodyExpr = arrow.body as { type: string };
  }

  // Unwrap ParenthesisExpression wrapping ObjectExpression
  if (bodyExpr?.type === "ParenthesisExpression") {
    bodyExpr = (bodyExpr as unknown as { expression: { type: string } }).expression;
  }

  if (!bodyExpr || bodyExpr.type !== "ObjectExpression") {
    return [];
  }

  const objExpr = bodyExpr as unknown as ObjectExpression;
  const children: FieldCallNode[] = [];

  for (const prop of objExpr.properties) {
    if (prop.type !== "SpreadElement") continue;

    // SpreadElement.arguments is the spread expression: f("fieldName")(...)
    const outerCall = (prop as unknown as { arguments: { type: string } }).arguments;
    if (!outerCall || outerCall.type !== "CallExpression") continue;

    const outer = outerCall as unknown as CallExpression;

    // The callee of the outer call should itself be a CallExpression: f("fieldName")
    if (outer.callee.type !== "CallExpression") continue;
    const innerCall = outer.callee as CallExpression;

    // innerCall.callee should be Identifier (the "f" function)
    if (innerCall.callee.type !== "Identifier") continue;

    // innerCall.arguments[0] should be a StringLiteral — the field name
    const fieldNameArg = innerCall.arguments[0]?.expression;
    if (!fieldNameArg || fieldNameArg.type !== "StringLiteral") continue;

    const strLit = fieldNameArg as unknown as { value: string; span: { start: number; end: number } };
    const fieldName = strLit.value;

    // Compute spans
    const outerCallSpan = (outer as unknown as { span: { start: number; end: number } }).span;
    const strLitSpan = strLit.span;

    // callSpan covers the full outer expression; fieldNameSpan is inside quotes (adjust by +1/-1 for ASCII quote)
    const callSpan = positionCtx
      ? convertSpan(outerCallSpan, positionCtx)
      : { start: outerCallSpan.start, end: outerCallSpan.end };
    const fieldNameSpan = positionCtx
      ? {
          start: positionCtx.converter.byteOffsetToCharIndex(strLitSpan.start + 1 - positionCtx.spanOffset),
          end: positionCtx.converter.byteOffsetToCharIndex(strLitSpan.end - 1 - positionCtx.spanOffset),
        }
      : { start: strLitSpan.start + 1, end: strLitSpan.end - 1 };

    // Discriminate nested kind based on outer call arguments
    const nested = extractFieldCallNested(outer, positionCtx);

    children.push({ fieldName, fieldNameSpan, callSpan, nested });
  }

  return children;
};

/**
 * Extract the nested structure from an outer field call.
 * The outer call is: f("fieldName")(arg) where arg determines nesting.
 */
const extractFieldCallNested = (outer: CallExpression, positionCtx?: PositionTrackingContext): FieldCallNested | null => {
  const outerArg = outer.arguments[0]?.expression;

  // No argument or absent argument → scalar field
  if (!outerArg) return null;

  // Arrow function argument → object field (recurse into nested callback body)
  if (outerArg.type === "ArrowFunctionExpression") {
    const nestedArrow = outerArg as unknown as ArrowFunctionExpression;
    const argSpan = (outerArg as unknown as { span: { start: number; end: number } }).span;
    const span = positionCtx ? convertSpan(argSpan, positionCtx) : { start: argSpan.start, end: argSpan.end };
    const children = extractFieldCallChildren(nestedArrow, positionCtx);
    return { kind: "object", span, children };
  }

  // Object argument → union field
  if (outerArg.type === "ObjectExpression") {
    const unionObj = outerArg as unknown as ObjectExpression;
    const argSpan = (outerArg as unknown as { span: { start: number; end: number } }).span;
    const span = positionCtx ? convertSpan(argSpan, positionCtx) : { start: argSpan.start, end: argSpan.end };
    const branches: UnionBranchNode[] = [];

    for (const prop of unionObj.properties) {
      if (prop.type !== "KeyValueProperty") continue;

      const kvProp = prop as unknown as {
        key: { type: string; value: string; span: { start: number; end: number } };
        value: { type: string; span: { start: number; end: number } };
      };

      // Skip __typename: true (BooleanLiteral value)
      if (kvProp.key.value === "__typename" && kvProp.value.type === "BooleanLiteral") continue;

      // Key must be Identifier (type name)
      if (kvProp.key.type !== "Identifier") continue;

      // Value must be ArrowFunctionExpression
      if (kvProp.value.type !== "ArrowFunctionExpression") continue;

      const typeName = kvProp.key.value;
      const typeNameSpan = positionCtx
        ? convertSpan(kvProp.key.span, positionCtx)
        : { start: kvProp.key.span.start, end: kvProp.key.span.end };
      const branchSpan = positionCtx
        ? convertSpan(kvProp.value.span, positionCtx)
        : { start: kvProp.value.span.start, end: kvProp.value.span.end };

      const branchArrow = kvProp.value as unknown as ArrowFunctionExpression;
      const children = extractFieldCallChildren(branchArrow, positionCtx);

      branches.push({ typeName, typeNameSpan, branchSpan, children });
    }

    return { kind: "union", span, branches };
  }

  return null;
};

/**
 * Extract a field call tree from a callback builder expression.
 *
 * Expects a top-level expression of the callback builder pattern:
 *   `query("Name")({ fields: ({ f }) => ({ ...f("id")(), ...f("name")() }) })({})`
 *
 * Returns an `ExtractedFieldTree` describing the root children (fields on the root selection set),
 * or `null` if the expression is not a callback builder or has no `fields` property.
 *
 * The `positionCtx` is optional — when provided, all span values will be character offsets
 * in the original TypeScript source. When omitted, spans are raw SWC byte positions.
 */
export const extractFieldCallTree = (
  expr: Node,
  schemaName: string,
  positionCtx?: PositionTrackingContext,
): ExtractedFieldTree | null => {
  const result = findCallbackBuilderCalls(expr);
  if (!result) return null;

  const { curriedCall, configCall } = result;

  // Extract kind and elementName from the curried call: query("Name")
  const kind = (curriedCall.callee as { value: string }).value as OperationKind;
  const nameArg = curriedCall.arguments[0]?.expression;
  const elementName = nameArg?.type === "StringLiteral" ? (nameArg as { value: string }).value : undefined;

  // Find the `fields` property in the config object
  const configObj = configCall.arguments[0]?.expression as ObjectExpression;
  for (const prop of configObj.properties) {
    if (prop.type !== "KeyValueProperty") continue;

    const kvProp = prop as unknown as {
      key: { type: string; value: string };
      value: { type: string; span: { start: number; end: number } };
    };
    if (kvProp.key.type !== "Identifier" || kvProp.key.value !== "fields") continue;
    if (kvProp.value.type !== "ArrowFunctionExpression") continue;

    const fieldsArrow = kvProp.value as unknown as ArrowFunctionExpression;
    const fieldsSpan = kvProp.value.span;
    const rootSpan = positionCtx ? convertSpan(fieldsSpan, positionCtx) : { start: fieldsSpan.start, end: fieldsSpan.end };

    const children = extractFieldCallChildren(fieldsArrow, positionCtx);

    return {
      schemaName,
      kind,
      ...(elementName !== undefined ? { elementName } : {}),
      rootSpan,
      children,
    };
  }

  return null;
};
