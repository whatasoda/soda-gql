/**
 * Template detector: finds soda-gql tagged templates at a given position using the TypeScript AST.
 * @module
 */
import type ts from "typescript";

/** Operation kind extracted from tagged template tag name. */
export type OperationKind = "query" | "mutation" | "subscription" | "fragment";

/** Information about a detected soda-gql tagged template at a position. */
export type TemplateInfo = {
  /** Raw GraphQL content between backticks. */
  readonly content: string;
  /** Character offset (0-based) of the content start within the source file. */
  readonly contentStart: number;
  /** Operation kind from tag name. */
  readonly kind: OperationKind;
  /** Element name from curried tag call (e.g., "GetUser" from query("GetUser")). */
  readonly elementName: string | undefined;
  /** Type name from curried fragment call (e.g., "User" from fragment("UserFields", "User")). */
  readonly typeName: string | undefined;
  /** Resolved schema name from gql.{schemaName}. */
  readonly schemaName: string;
};

const OPERATION_KINDS = new Set<string>(["query", "mutation", "subscription", "fragment"]);

const isOperationKind = (value: string): value is OperationKind => OPERATION_KINDS.has(value);

/**
 * Find the deepest AST node at the given position.
 */
const findNodeAtPosition = (sourceFile: ts.SourceFile, position: number, typescript: typeof ts): ts.Node | undefined => {
  let result: ts.Node | undefined;

  const visit = (node: ts.Node): void => {
    if (position < node.getStart(sourceFile) || position >= node.getEnd()) {
      return;
    }
    result = node;
    typescript.forEachChild(node, visit);
  };

  typescript.forEachChild(sourceFile, visit);
  return result;
};

/**
 * Walk up from a node to find an enclosing TaggedTemplateExpression
 * whose tag is a curried soda-gql call (e.g., query("Name")`...`).
 */
const findEnclosingTaggedTemplate = (
  node: ts.Node,
  sourceFile: ts.SourceFile,
  position: number,
  typescript: typeof ts,
): ts.TaggedTemplateExpression | undefined => {
  let current: ts.Node | undefined = node;
  while (current) {
    if (typescript.isTaggedTemplateExpression(current)) {
      // Check the position is inside the template portion, not the tag
      const template = current.template;
      const templateStart = template.getStart(sourceFile);
      const templateEnd = template.getEnd();
      if (position >= templateStart && position < templateEnd) {
        return current;
      }
    }
    current = current.parent;
  }
  return undefined;
};

/**
 * Check if an expression is a reference to the `gql` identifier.
 * Supports: `gql`, `gql.something.gql`, etc.
 */
const isGqlReference = (expr: ts.Expression, typescript: typeof ts): boolean => {
  if (typescript.isIdentifier(expr) && expr.text === "gql") {
    return true;
  }
  if (!typescript.isPropertyAccessExpression(expr)) {
    return false;
  }
  if (typescript.isIdentifier(expr.name) && expr.name.text === "gql") {
    return true;
  }
  return isGqlReference(expr.expression, typescript);
};

/**
 * Walk up from a TaggedTemplateExpression to find the enclosing `gql.{schemaName}()` call.
 * Returns the schema name if found.
 */
const findSchemaName = (tagged: ts.TaggedTemplateExpression, typescript: typeof ts): string | undefined => {
  let current: ts.Node | undefined = tagged.parent;
  while (current) {
    if (typescript.isCallExpression(current)) {
      // Check if this is gql.{schemaName}(arrowFunction)
      if (typescript.isPropertyAccessExpression(current.expression)) {
        const propAccess = current.expression;
        if (isGqlReference(propAccess.expression, typescript)) {
          return propAccess.name.text;
        }
      }
    }
    current = current.parent;
  }
  return undefined;
};

/**
 * Extract template information from a TaggedTemplateExpression.
 * Validates curried syntax: query("Name")`...` or fragment("Name", "Type")`...`
 */
const extractTemplateInfo = (
  tagged: ts.TaggedTemplateExpression,
  schemaName: string,
  sourceFile: ts.SourceFile,
  typescript: typeof ts,
): TemplateInfo | null => {
  // Tag must be a CallExpression: query("Name")`...`
  if (!typescript.isCallExpression(tagged.tag)) {
    return null;
  }

  const tagCall = tagged.tag;
  if (!typescript.isIdentifier(tagCall.expression)) {
    return null;
  }

  const kind = tagCall.expression.text;
  if (!isOperationKind(kind)) {
    return null;
  }

  // Extract element name and type name from curried call arguments
  let elementName: string | undefined;
  let typeName: string | undefined;
  const firstArg = tagCall.arguments[0];
  if (firstArg && typescript.isStringLiteral(firstArg)) {
    elementName = firstArg.text;
  }
  const secondArg = tagCall.arguments[1];
  if (secondArg && typescript.isStringLiteral(secondArg)) {
    typeName = secondArg.text;
  }

  // Extract template content
  const template = tagged.template;
  let content: string;
  let contentStart: number;

  if (typescript.isNoSubstitutionTemplateLiteral(template)) {
    content = template.text;
    // +1 to skip the opening backtick
    contentStart = template.getStart(sourceFile) + 1;
  } else {
    // TemplateExpression with substitutions — extract full raw text between backticks
    const templateStart = template.getStart(sourceFile);
    const templateEnd = template.getEnd();
    // Get the full text including backticks, then strip them
    const fullText = sourceFile.text.slice(templateStart + 1, templateEnd - 1);
    content = fullText;
    contentStart = templateStart + 1;
  }

  return {
    content,
    contentStart,
    kind,
    elementName,
    typeName,
    schemaName,
  };
};

/**
 * Find a soda-gql tagged template at the given position in a source file.
 *
 * Walks the AST to find the deepest node at position, then walks up to find
 * an enclosing TaggedTemplateExpression with curried syntax, and further up
 * to find the enclosing gql.{schemaName}() call.
 *
 * @returns TemplateInfo if position is inside a valid soda-gql tagged template, null otherwise
 */
export const findTemplateAtPosition = (
  sourceFile: ts.SourceFile,
  position: number,
  typescript: typeof ts,
): TemplateInfo | null => {
  const node = findNodeAtPosition(sourceFile, position, typescript);
  if (!node) {
    return null;
  }

  const tagged = findEnclosingTaggedTemplate(node, sourceFile, position, typescript);
  if (!tagged) {
    return null;
  }

  const schemaName = findSchemaName(tagged, typescript);
  if (!schemaName) {
    return null;
  }

  return extractTemplateInfo(tagged, schemaName, sourceFile, typescript);
};
