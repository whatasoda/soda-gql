interface Entry {
  label: string;
  inner: string;
  outer: string;
  modifier: string;
  signatureName: string;
  innerSignatureName: string;
}

/**
 * Converts a modifier string to a readable signature name.
 * Examples:
 * - "!" -> "Required"
 * - "?" -> "Optional"
 * - "![]!" -> "RequiredList_Required"
 * - "![]?" -> "RequiredList_Optional"
 * - "?[]!" -> "OptionalList_Required"
 * - "?[]?" -> "OptionalList_Optional"
 */
function modifierToSignatureName(modifier: string): string {
  const parts = modifier.split("[]");
  return parts.map(p => p === "!" ? "Required" : "Optional").join("List_");
}

function* generateEntriesForDepth (depth: number): Generator<Entry> {
  const width = depth + 1;
  for (let i = 0; i < 2 ** width; i++) {
    const label = i.toString(2).padStart(width, "0");
    const modifier = label.split("").map((num) => num === "1" ? "?" : "!").join("[]");
    const innerLabel = label.slice(0, -1);
    const innerModifier = innerLabel.split("").map((num) => num === "1" ? "?" : "!").join("[]");
    yield {
      label,
      inner: innerLabel,
      outer: label.slice(-1),
      modifier,
      signatureName: modifierToSignatureName(modifier),
      innerSignatureName: innerLabel ? modifierToSignatureName(innerModifier) : "",
    };
  }
}

function embedEntries({ from, to }: { from: number; to: number; }) {
  return function (template: { raw: readonly string[] | ArrayLike<string>; }, ...printers: ((entry: Entry) => string)[]) {
    const lines = [];

    for (let depth = from; depth <= to; depth++) {
      lines.push(String.raw(template, `// depth = ${depth}`));
      for (const entry of generateEntriesForDepth(depth)) {
        lines.push(String.raw(template, ...printers.map((printer) => printer(entry))));
      }
      if (depth < to) {
        lines.push("");
      }
    }

    return lines.map((line) => line.replace(/(^\n|\n$)/g, "")).join("\n");
  }
}

const DEPTH = 3;
const CORE = "packages/core/src/types/type-foundation/type-modifier-core.generated.ts";
const EXTENSION = "packages/core/src/types/type-foundation/type-modifier-extension.generated.ts";

const core_content = `\
export type TypeModifier = string;
export type ValidTypeModifier =
${embedEntries({ from: 0, to: DEPTH })`
  ${({ modifier }) => `| "${modifier}"`}
`};

type Op_0<T> = T[];
type Op_1<T> = T[] | null | undefined;

// Modified - applies type modifier to a value type
// depth = 0
type Modified_0<T> = T;
type Modified_1<T> = T | null | undefined;

${embedEntries({ from: 1, to: DEPTH })`
${({ label, inner, outer }) => `type Modified_${label}<T> = Op_${outer}<Modified_${inner}<T>>;`}
`}

export type ApplyTypeModifier<T, M extends TypeModifier> =
${embedEntries({ from: 0, to: DEPTH })`
  ${({ label, modifier }) => `M extends "${modifier}" ? Modified_${label}<T> :`}
`} never;

// Signature - pre-computed signature patterns for VarRef type matching
// These type names are designed to appear in TypeScript error messages,
// making it clear what modifier mismatch occurred.
// depth = 0
type Signature_Required = "[TYPE_SIGNATURE]";
type Signature_Optional = Signature_Required | null | undefined;

${embedEntries({ from: 1, to: DEPTH })`
${({ signatureName, innerSignatureName, outer }) => `type Signature_${signatureName} = Op_${outer}<Signature_${innerSignatureName}>;`}
`}

export type GetSignature<M extends TypeModifier> =
${embedEntries({ from: 0, to: DEPTH })`
  ${({ signatureName, modifier }) => `M extends "${modifier}" ? Signature_${signatureName} :`}
`} never;
`

const extension_content = `\
import type { ApplyTypeModifier, GetSignature } from "./type-modifier-core.generated";
import type { ObjectTypeProfile, PrimitiveTypeProfile, TypeProfile, VarRef } from "./type-modifier-extension.injection";

type Op_0<T> = T[];
type Op_1<T> = T[] | null | undefined;

// Ref derives typeName and kind from T (TypeProfile), uses GetSignature for type matching
type Ref<T extends TypeProfile, M extends string> = VarRef<TypeProfile.VarRefBrand<T, GetSignature<M>>>;

// Helper types for optional field detection in nested Input objects
type IsOptionalProfile<TField extends TypeProfile.WithMeta> = TField[1] extends \`\${string}?\`
  ? true
  : TField[2] extends TypeProfile.WITH_DEFAULT_INPUT
    ? true
    : false;

type OptionalProfileKeys<TProfileObject extends { readonly [key: string]: TypeProfile.WithMeta }> = {
  [K in keyof TProfileObject]: IsOptionalProfile<TProfileObject[K]> extends true ? K : never;
}[keyof TProfileObject];

type RequiredProfileKeys<TProfileObject extends { readonly [key: string]: TypeProfile.WithMeta }> = {
  [K in keyof TProfileObject]: IsOptionalProfile<TProfileObject[K]> extends false ? K : never;
}[keyof TProfileObject];

type Simplify<T> = { [K in keyof T]: T[K] } & {};

// AssignableObjectType - builds object type with VarRef allowed in nested fields
// Uses forward reference to GetAssignableType for recursive VarRef support
type AssignableObjectType<TProfileObject extends { readonly [key: string]: TypeProfile.WithMeta }> = Simplify<
  {
    readonly [K in OptionalProfileKeys<TProfileObject>]+?: TProfileObject[K] extends TypeProfile.WithMeta
      ? GetAssignableType<TProfileObject[K]>
      : never;
  } & {
    readonly [K in RequiredProfileKeys<TProfileObject>]-?: TProfileObject[K] extends TypeProfile.WithMeta
      ? GetAssignableType<TProfileObject[K]>
      : never;
  }
>;

// AssignableConstBase - base const type with VarRef allowed in nested object fields
type AssignableConstBase<TProfile extends TypeProfile.WithMeta> = ApplyTypeModifier<
  TProfile[0] extends PrimitiveTypeProfile
    ? TProfile[0]["value"]
    : TProfile[0] extends ObjectTypeProfile
      ? AssignableObjectType<TProfile[0]["fields"]>
      : never,
  TProfile[1]
>;

// AssignableInternal - recursive types without default value consideration
// T is TypeProfile (not WithMeta) since signature is pre-computed via GetSignature
// depth = 0
type AssignableInternal_0<T extends TypeProfile> = AssignableConstBase<[T, "!"]> | Ref<T, "!">;
type AssignableInternal_1<T extends TypeProfile> = AssignableConstBase<[T, "?"]> | Ref<T, "?">;

${embedEntries({ from: 1, to: DEPTH })`
${({ label, inner, outer, modifier }) => `type AssignableInternal_${label}<T extends TypeProfile> = Ref<T, "${modifier}"> | Op_${outer}<AssignableInternal_${inner}<T>>;`}
`}

// AssignableInternalByModifier - selects AssignableInternal type based on modifier
// Takes WithMeta and passes T[0] (TypeProfile) to internal types
type AssignableInternalByModifier<T extends TypeProfile.WithMeta> =
${embedEntries({ from: 0, to: DEPTH })`
  ${({ label, modifier }) => `T[1] extends "${modifier}" ? AssignableInternal_${label}<T[0]> :`}
`} never;

// Assignable - entrypoint that handles default value at the outermost level
type Assignable<T extends TypeProfile.WithMeta> =
  | AssignableInternalByModifier<T>
  | (T[2] extends TypeProfile.WITH_DEFAULT_INPUT ? undefined : never);

/**
 * Assignable type using typeName + kind for VarRef comparison.
 * Accepts const values or VarRefs with matching typeName + kind + signature.
 * Allows VarRef at any level in nested object fields.
 * Default value handling is applied at the outermost level only.
 */
export type GetAssignableType<T extends TypeProfile.WithMeta> = Assignable<T>;
`

await Bun.write(CORE, core_content);
await Bun.write(EXTENSION, extension_content);

export {};
