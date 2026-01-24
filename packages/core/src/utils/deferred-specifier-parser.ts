/**
 * Runtime parser for deferred specifier strings.
 *
 * Parses string literal specifiers like "s|uuid|!" into structured objects
 * for runtime operations that need to access specifier properties.
 */

import type { InputTypeKind, OutputTypeKind } from "../types/type-foundation/type-specifier";

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
};

const OUTPUT_KIND_MAP: Record<string, OutputTypeKind> = {
  s: "scalar",
  e: "enum",
  o: "object",
  u: "union",
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
 *
 * @example
 * parseOutputSpecifier("o|users|![]!")
 * // { kind: "object", name: "users", modifier: "![]!", arguments: {} }
 *
 * parseOutputSpecifier("s|Int|!|columns:e|select_column|![]?")
 * // { kind: "scalar", name: "Int", modifier: "!", arguments: { columns: "e|select_column|![]?" } }
 */
export function parseOutputSpecifier(spec: string): ParsedOutputSpecifier {
  const parts = spec.split("|");

  const kindChar = parts[0]!;
  const name = parts[1]!;

  const kind = OUTPUT_KIND_MAP[kindChar];
  if (!kind) {
    throw new Error(`Invalid output specifier kind: ${kindChar}`);
  }

  // Find where the modifier ends and arguments begin
  // Modifier is at index 2, arguments start at index 3
  const modifier = parts[2]!;
  const arguments_: Record<string, string> = {};

  // Parse arguments if present (format: "argName:k|Type|Mod,argName2:k|Type|Mod")
  if (parts.length > 3) {
    const argsStr = parts.slice(3).join("|");
    const argPairs = splitArguments(argsStr);

    for (const argPair of argPairs) {
      const colonIdx = argPair.indexOf(":");
      if (colonIdx > 0) {
        const argName = argPair.slice(0, colonIdx);
        const argSpec = argPair.slice(colonIdx + 1);
        // Store the deferred string, don't parse
        arguments_[argName] = argSpec;
      }
    }
  }

  return { kind, name, modifier, arguments: arguments_ };
}

/**
 * Split comma-separated arguments while respecting nested specifiers.
 * Arguments are separated by commas, but each argument contains pipes.
 */
function splitArguments(argsStr: string): string[] {
  const result: string[] = [];
  let current = "";
  let pipeCount = 0;

  for (const char of argsStr) {
    if (char === "|") {
      pipeCount++;
      current += char;
    } else if (char === "," && pipeCount >= 2) {
      // At least 2 pipes means we've seen a complete specifier
      result.push(current);
      current = "";
      pipeCount = 0;
    } else {
      current += char;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}
