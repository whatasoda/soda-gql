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
export type GetSpecKind<T extends string> =
  ParseBasicSpec<T> extends { kind: infer K extends string }
    ? K extends "s" ? "scalar"
    : K extends "e" ? "enum"
    : K extends "o" ? "object"
    : K extends "u" ? "union"
    : K extends "i" ? "input"
    : never
    : never;

/**
 * Get name from deferred specifier string.
 * Uses direct pattern matching with string constraint for better narrowing.
 */
export type GetSpecName<T extends string> =
  T extends `${string}|${infer N extends string}|${string}` ? N : never;

/**
 * Get modifier from deferred specifier string.
 * Uses direct pattern matching with string constraint for better narrowing.
 */
export type GetSpecModifier<T extends string> =
  T extends `${string}|${string}|${infer M extends string}` ? ExtractModifier<M> : never;

/**
 * Get defaultValue indicator from deferred specifier string
 * Returns AnyDefaultValue if |D suffix present, null otherwise
 *
 * Note: Returns AnyDefaultValue (not the actual value) because the deferred
 * format only indicates presence, not the actual default value.
 * This is sufficient for type-level checks like IsOptional.
 */
export type GetSpecDefaultValue<T extends string> =
  T extends `${string}|D` ? AnyDefaultValue : null;

// ============================================================
// Arguments Extraction (as InputTypeSpecifiers)
// ============================================================

/**
 * Parse single argument "argName:k|Type|Mod" and return as deferred input specifier
 */
type ParseSingleArgAsDeferred<S extends string> =
  S extends `${infer ArgName}:${infer Spec}`
    ? { readonly [K in ArgName]: Spec }
    : {};

/**
 * Parse comma-separated argument list as deferred input specifiers
 */
type ParseArgListAsDeferred<S extends string> =
  S extends "" ? {} :
  S extends `${infer Arg},${infer Rest}`
    ? ParseSingleArgAsDeferred<Arg> & ParseArgListAsDeferred<Rest>
    : ParseSingleArgAsDeferred<S>;

/**
 * Extract arguments from output specifier as InputTypeSpecifiers (deferred strings).
 * Returns a record of deferred input specifier strings, not parsed objects.
 *
 * @deprecated Use GetFieldArguments for new code (handles both inline and object formats)
 *
 * @example
 * GetSpecArguments<"o|users|!|limit:s|Int|?,offset:s|Int|?">
 * // { limit: "s|Int|?"; offset: "s|Int|?" }
 */
export type GetSpecArguments<S extends string> =
  S extends `${string}|${string}|${infer ModAndArgs}`
    ? ModAndArgs extends `${infer _Mod}|${infer Args}`
      ? ParseArgListAsDeferred<StripDefaultSuffix<Args>>
      : {}
    : {};

// ============================================================
// Field Specifier Utilities (Handles both string and object formats)
// ============================================================

import type { DeferredOutputField, DeferredOutputFieldWithArgs, DeferredOutputSpecifier, InputTypeSpecifiers } from "./type-specifier";

/**
 * Extract the spec string from a field specifier.
 * Handles both simple string format and object format with arguments.
 *
 * @example
 * GetFieldSpec<"o|User|!">
 * // "o|User|!"
 *
 * GetFieldSpec<{ spec: "o|User|!", arguments: { id: "s|ID|!" } }>
 * // "o|User|!"
 */
export type GetFieldSpec<T extends DeferredOutputField> =
  T extends DeferredOutputSpecifier
    ? T
    : T extends DeferredOutputFieldWithArgs
      ? T["spec"]
      : never;

/**
 * Extract arguments from a field specifier.
 * Handles both inline string format (legacy) and object format (new).
 *
 * @example
 * // Legacy inline format
 * GetFieldArguments<"o|User|!|id:s|ID|!">
 * // { id: "s|ID|!" }
 *
 * // New object format
 * GetFieldArguments<{ spec: "o|User|!", arguments: { id: "s|ID|!" } }>
 * // { id: "s|ID|!" }
 *
 * // No arguments
 * GetFieldArguments<"o|User|!">
 * // {}
 */
export type GetFieldArguments<T extends DeferredOutputField> =
  T extends DeferredOutputSpecifier
    ? GetSpecArguments<T>  // Parse inline arguments (backward compat)
    : T extends { arguments: infer A extends InputTypeSpecifiers }
      ? A
      : {};

/**
 * Parse a field specifier to structured output type.
 * Handles both string and object formats.
 */
export type ParseFieldSpec<T extends DeferredOutputField> =
  T extends DeferredOutputSpecifier
    ? ParseDeferredOutputSpec<T>
    : T extends DeferredOutputFieldWithArgs
      ? ParseDeferredOutputSpec<T["spec"]> extends infer Base
        ? Base extends { kind: infer K; name: infer N; modifier: infer M }
          ? { readonly kind: K; readonly name: N; readonly modifier: M; readonly arguments: T["arguments"] }
          : never
        : never
      : never;
