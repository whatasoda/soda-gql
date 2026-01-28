/**
 * Runtime parser for deferred specifier strings.
 *
 * Parses string literal specifiers like "s|uuid|!" into structured objects
 * for runtime operations that need to access specifier properties.
 */

import type {
  DeferredOutputField,
  DeferredOutputFieldWithArgs,
  InputTypeKind,
  OutputTypeKind,
} from "../types/type-foundation/type-specifier";

export type ParsedInputSpecifier = {
  kind: InputTypeKind;
  name: string;
  modifier: string;
  hasDefault: boolean;
};

export type ParsedOutputSpecifier = {
  kind: OutputTypeKind;
  name: string;
  modifier: string;
  /** Deferred input specifier strings for arguments */
  arguments: Record<string, string>;
};

const INPUT_KIND_MAP: Record<string, InputTypeKind> = {
  s: "scalar",
  e: "enum",
  i: "input",
  x: "excluded",
};

const OUTPUT_KIND_MAP: Record<string, OutputTypeKind> = {
  s: "scalar",
  e: "enum",
  o: "object",
  u: "union",
  x: "excluded",
};

/**
 * Parse a deferred input specifier string into a structured object.
 *
 * @example
 * parseInputSpecifier("s|uuid|!")
 * // { kind: "scalar", name: "uuid", modifier: "!", hasDefault: false }
 *
 * parseInputSpecifier("e|order_by|?|D")
 * // { kind: "enum", name: "order_by", modifier: "?", hasDefault: true }
 */
export function parseInputSpecifier(spec: string): ParsedInputSpecifier {
  const hasDefault = spec.endsWith("|D");
  const parts = spec.split("|");

  const kindChar = parts[0]!;
  const name = parts[1]!;
  // Modifier is everything after kind|name| but before any |D suffix
  const modifier = hasDefault ? parts[2]! : parts.slice(2).join("|");

  const kind = INPUT_KIND_MAP[kindChar];
  if (!kind) {
    throw new Error(`Invalid input specifier kind: ${kindChar}`);
  }

  return { kind, name, modifier, hasDefault };
}

/**
 * Parse a deferred output specifier string into a structured object.
 * Note: Output specifiers no longer contain inline arguments.
 * Use parseOutputField() for field specifiers that may have arguments.
 *
 * @example
 * parseOutputSpecifier("o|users|![]!")
 * // { kind: "object", name: "users", modifier: "![]!", arguments: {} }
 */
export function parseOutputSpecifier(spec: string): ParsedOutputSpecifier {
  const parts = spec.split("|");

  const kindChar = parts[0]!;
  const name = parts[1]!;
  const modifier = parts[2]!;

  const kind = OUTPUT_KIND_MAP[kindChar];
  if (!kind) {
    throw new Error(`Invalid output specifier kind: ${kindChar}`);
  }

  return { kind, name, modifier, arguments: {} };
}

// ============================================================
// Field Specifier Parsing (handles both string and object formats)
// ============================================================

/**
 * Type guard to check if a field specifier has extracted arguments.
 *
 * @example
 * isFieldWithArgs("o|User|!")  // false
 * isFieldWithArgs({ spec: "o|User|!", arguments: { id: "s|ID|!" } })  // true
 */
export function isFieldWithArgs(field: DeferredOutputField): field is DeferredOutputFieldWithArgs {
  return typeof field === "object" && field !== null && "spec" in field;
}

/**
 * Parse a field specifier into a structured object.
 * Handles both string format (no arguments) and object format (with arguments).
 *
 * @example
 * // Object format (with arguments)
 * parseOutputField({ spec: "o|User|!", arguments: { id: "s|ID|!" } })
 * // { kind: "object", name: "User", modifier: "!", arguments: { id: "s|ID|!" } }
 *
 * // String format (no arguments)
 * parseOutputField("s|String|!")
 * // { kind: "scalar", name: "String", modifier: "!", arguments: {} }
 */
export function parseOutputField(field: DeferredOutputField): ParsedOutputSpecifier {
  if (isFieldWithArgs(field)) {
    // Object format - arguments in separate property
    const spec = parseOutputSpecifier(field.spec);
    return { ...spec, arguments: field.arguments };
  }
  // String format - no arguments
  return parseOutputSpecifier(field);
}
