/**
 * Deferred Type Specifier Parser Types
 *
 * Parses string literal type specifiers like "s|uuid|!" back to structured types.
 * This enables type inference while deferring instantiation until access time.
 *
 * Format: {kind}|{name}|{modifier}[|{args}][|D]
 *
 * Examples:
 * - "s|uuid|!"             → { kind: "scalar", name: "uuid", modifier: "!" }
 * - "o|users|![]!"         → { kind: "object", name: "users", modifier: "![]!" }
 * - "s|Int|!|col:e|X|?"    → with arguments
 */

import type { TypeModifier } from "./type-modifier-core.generated";
import type { AnyDefaultValue } from "./type-specifier";

// ============================================================
// Kind Character Mapping
// ============================================================

/**
 * Parse input kind character to full kind name
 * s=scalar, e=enum, i=input
 */
type ParseInputKind<K extends string> = K extends "s" ? "scalar" : K extends "e" ? "enum" : K extends "i" ? "input" : never;

/**
 * Parse output kind character to full kind name
 * s=scalar, e=enum, o=object, u=union
 */
type ParseOutputKind<K extends string> = K extends "s"
  ? "scalar"
  : K extends "e"
    ? "enum"
    : K extends "o"
      ? "object"
      : K extends "u"
        ? "union"
        : never;

// ============================================================
// Basic Specifier Parser
// ============================================================

/**
 * Extract modifier portion, stopping at first | (for args separation)
 */
type ExtractModifier<S extends string> = S extends `${infer M}|${string}` ? M : S;

/**
 * Parse basic specifier format: "k|name|modifier..."
 * Returns { kind, name, modifier } or never if invalid
 */
type ParseBasicSpec<S extends string> = S extends `${infer K}|${infer Rest}`
  ? Rest extends `${infer N}|${infer M}`
    ? { kind: K; name: N; modifier: ExtractModifier<M> }
    : never
  : never;

// ============================================================
// Input Specifier Resolution
// ============================================================

/**
 * Parse deferred input specifier to structured type
 *
 * @example
 * ParseDeferredInputSpec<"s|uuid|!">
 * // { kind: "scalar"; name: "uuid"; modifier: "!"; defaultValue: null }
 *
 * ParseDeferredInputSpec<"e|order_by|?|D">
 * // { kind: "enum"; name: "order_by"; modifier: "?"; defaultValue: { default: unknown } }
 */
export type ParseDeferredInputSpec<S extends string> = ParseBasicSpec<S> extends {
  kind: infer K extends string;
  name: infer N;
  modifier: infer M;
}
  ? M extends TypeModifier
    ? {
        readonly kind: ParseInputKind<K>;
        readonly name: N;
        readonly modifier: M;
        readonly defaultValue: S extends `${string}|D` ? { default: unknown } : null;
      }
    : never
  : never;

// ============================================================
// Output Specifier Resolution
// ============================================================

/**
 * Parse deferred output specifier to structured type.
 * Output specifiers no longer contain inline arguments - use DeferredOutputFieldWithArgs instead.
 *
 * @example
 * ParseDeferredOutputSpec<"o|users|![]!">
 * // { kind: "object"; name: "users"; modifier: "![]!" }
 */
export type ParseDeferredOutputSpec<S extends string> = ParseBasicSpec<S> extends {
  kind: infer K extends string;
  name: infer N;
  modifier: infer M;
}
  ? M extends TypeModifier
    ? {
        readonly kind: ParseOutputKind<K>;
        readonly name: N;
        readonly modifier: M;
      }
    : never
  : never;

// ============================================================
// Resolution Utilities (String-Only)
// ============================================================

/**
 * Resolve deferred input specifier to structured form
 */
export type ResolveInputSpec<T extends string> = ParseDeferredInputSpec<T>;

/**
 * Resolve deferred output specifier to structured form
 */
export type ResolveOutputSpec<T extends string> = ParseDeferredOutputSpec<T>;

/**
 * Get kind from deferred specifier string
 */
export type GetSpecKind<T extends string> = ParseBasicSpec<T> extends { kind: infer K extends string }
  ? K extends "s"
    ? "scalar"
    : K extends "e"
      ? "enum"
      : K extends "o"
        ? "object"
        : K extends "u"
          ? "union"
          : K extends "i"
            ? "input"
            : never
  : never;

/**
 * Get name from deferred specifier string.
 * Uses direct pattern matching with string constraint for better narrowing.
 */
export type GetSpecName<T extends string> = T extends `${string}|${infer N extends string}|${string}` ? N : never;

/**
 * Get modifier from deferred specifier string.
 * Uses direct pattern matching with string constraint for better narrowing.
 */
export type GetSpecModifier<T extends string> = T extends `${string}|${string}|${infer M extends string}`
  ? ExtractModifier<M>
  : never;

/**
 * Get defaultValue indicator from deferred specifier string
 * Returns AnyDefaultValue if |D suffix present, null otherwise
 *
 * Note: Returns AnyDefaultValue (not the actual value) because the deferred
 * format only indicates presence, not the actual default value.
 * This is sufficient for type-level checks like IsOptional.
 */
export type GetSpecDefaultValue<T extends string> = T extends `${string}|D` ? AnyDefaultValue : null;

// ============================================================
// Field Specifier Utilities (Handles both string and object formats)
// ============================================================

import type { DeferredOutputField, DeferredOutputFieldWithArgs } from "./type-specifier";

/**
 * Extract the spec string from a field specifier.
 * - String format: returns the string as-is
 * - Object format: returns the spec property
 *
 * @example
 * GetFieldSpec<"o|User|!">
 * // "o|User|!"
 *
 * GetFieldSpec<{ spec: "o|User|!", arguments: { id: "s|ID|!" } }>
 * // "o|User|!"
 */
export type GetFieldSpec<T extends DeferredOutputField> = T extends DeferredOutputFieldWithArgs ? T["spec"] : T;

/**
 * Extract arguments from a field specifier.
 * - String format (no arguments): returns {}
 * - Object format: returns the arguments property
 *
 * @example
 * GetFieldArguments<{ spec: "o|User|!", arguments: { id: "s|ID|!" } }>
 * // { id: "s|ID|!" }
 *
 * GetFieldArguments<"o|User|!">
 * // {}
 */
export type GetFieldArguments<T extends DeferredOutputField> = T extends DeferredOutputFieldWithArgs ? T["arguments"] : {};

/**
 * Parse a field specifier to structured output type.
 * - String format: parses the spec string
 * - Object format: parses the spec and includes arguments
 */
export type ParseFieldSpec<T extends DeferredOutputField> = T extends DeferredOutputFieldWithArgs
  ? ParseDeferredOutputSpec<T["spec"]> extends infer Base
    ? Base extends { kind: infer K; name: infer N; modifier: infer M }
      ? { readonly kind: K; readonly name: N; readonly modifier: M; readonly arguments: T["arguments"] }
      : never
    : never
  : ParseDeferredOutputSpec<T & string>;
