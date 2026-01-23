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

// ============================================================
// Kind Character Mapping
// ============================================================

/**
 * Parse input kind character to full kind name
 * s=scalar, e=enum, i=input
 */
type ParseInputKind<K extends string> =
  K extends "s" ? "scalar" :
  K extends "e" ? "enum" :
  K extends "i" ? "input" : never;

/**
 * Parse output kind character to full kind name
 * s=scalar, e=enum, o=object, u=union
 */
type ParseOutputKind<K extends string> =
  K extends "s" ? "scalar" :
  K extends "e" ? "enum" :
  K extends "o" ? "object" :
  K extends "u" ? "union" : never;

// ============================================================
// Basic Specifier Parser
// ============================================================

/**
 * Extract modifier portion, stopping at first | (for args separation)
 */
type ExtractModifier<S extends string> =
  S extends `${infer M}|${string}` ? M : S;

/**
 * Parse basic specifier format: "k|name|modifier..."
 * Returns { kind, name, modifier } or never if invalid
 */
type ParseBasicSpec<S extends string> =
  S extends `${infer K}|${infer Rest}`
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
export type ParseDeferredInputSpec<S extends string> =
  ParseBasicSpec<S> extends { kind: infer K extends string; name: infer N; modifier: infer M }
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
// Arguments Parser
// ============================================================

/**
 * Extract arguments from specifier string after kind|name|modifier
 * Format: "arg1:k|T|M,arg2:k|T|M"
 *
 * Note: Complex argument parsing has limitations due to TypeScript
 * template literal type inference. For simple single-arg cases, works well.
 * Multi-arg cases may need runtime parsing.
 */
type ExtractArgsFromFull<S extends string> =
  // Match: k|name|mod|args pattern
  S extends `${string}|${string}|${infer ModAndArgs}`
    ? ModAndArgs extends `${infer _Mod}|${infer Args}`
      ? ParseArgList<StripDefaultSuffix<Args>>
      : {}
    : {};

/**
 * Strip |D suffix if present
 */
type StripDefaultSuffix<S extends string> =
  S extends `${infer Rest}|D` ? Rest : S;

/**
 * Parse comma-separated argument list
 */
type ParseArgList<S extends string> =
  S extends "" ? {} :
  S extends `${infer Arg},${infer Rest}`
    ? ParseSingleArg<Arg> & ParseArgList<Rest>
    : ParseSingleArg<S>;

/**
 * Parse single argument "argName:k|Type|Mod"
 */
type ParseSingleArg<S extends string> =
  S extends `${infer ArgName}:${infer Spec}`
    ? { readonly [K in ArgName]: ParseDeferredInputSpec<Spec> }
    : {};

// ============================================================
// Output Specifier Resolution
// ============================================================

/**
 * Parse deferred output specifier to structured type
 *
 * @example
 * ParseDeferredOutputSpec<"o|users|![]!">
 * // { kind: "object"; name: "users"; modifier: "![]!"; arguments: {} }
 *
 * ParseDeferredOutputSpec<"s|Int|!|columns:e|select_column|![]?,distinct:s|Boolean|?">
 * // { kind: "scalar"; name: "Int"; modifier: "!"; arguments: { columns: {...}, distinct: {...} } }
 */
export type ParseDeferredOutputSpec<S extends string> =
  ParseBasicSpec<S> extends { kind: infer K extends string; name: infer N; modifier: infer M }
    ? M extends TypeModifier
      ? {
          readonly kind: ParseOutputKind<K>;
          readonly name: N;
          readonly modifier: M;
          readonly arguments: ExtractArgsFromFull<S>;
        }
      : never
    : never;

// ============================================================
// Resolution Utilities
// ============================================================

/**
 * Resolve any input specifier (deferred string or structured) to structured form
 */
export type ResolveInputSpec<T> =
  T extends string ? ParseDeferredInputSpec<T> : T;

/**
 * Resolve any output specifier (deferred string or structured) to structured form
 */
export type ResolveOutputSpec<T> =
  T extends string ? ParseDeferredOutputSpec<T> : T;

/**
 * Get kind from any specifier format
 */
export type GetSpecKind<T> =
  T extends string
    ? ParseBasicSpec<T> extends { kind: infer K extends string }
      ? K extends "s" ? "scalar"
      : K extends "e" ? "enum"
      : K extends "o" ? "object"
      : K extends "u" ? "union"
      : K extends "i" ? "input"
      : never
      : never
    : T extends { kind: infer K } ? K : never;

/**
 * Get name from any specifier format
 */
export type GetSpecName<T> =
  T extends string
    ? ParseBasicSpec<T> extends { name: infer N } ? N : never
    : T extends { name: infer N } ? N : never;

/**
 * Get modifier from any specifier format
 */
export type GetSpecModifier<T> =
  T extends string
    ? ParseBasicSpec<T> extends { modifier: infer M } ? M : never
    : T extends { modifier: infer M } ? M : never;
