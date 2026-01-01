interface Entry {
  label: string;
  inner: string;
  outer: string;
  modifier: string;
}

function* generateEntriesForDepth (depth: number): Generator<Entry> {
  const width = depth + 1;
  for (let i = 0; i < 2 ** width; i++) {
    const label = i.toString(2).padStart(width, "0");
    yield {
      label,
      inner: label.slice(0, -1),
      outer: label.slice(-1),
      modifier: label.split("").map((num) => num === "1" ? "?" : "!").join("[]"),
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

interface Op<T> {
  readonly 0: T[];
  readonly 1: T[] | null | undefined;
}

// Modified
// depth = 0
type Modified_0<T> = T;
type Modified_1<T> = T | null | undefined;

${embedEntries({ from: 1, to: DEPTH })`
${({ label, inner, outer }) => `type Modified_${label}<T> = Op<Modified_${inner}<T>>[${outer}];`}
`}

export type ApplyTypeModifier<T, M extends TypeModifier> =
${embedEntries({ from: 0, to: DEPTH })`
  ${({ label, modifier }) => `M extends "${modifier}" ? Modified_${label}<T> :`}
`} never;
`

const extension_content = `\
import type { AssignableConstBase, TypeProfile, VarRef } from "./type-modifier-extension.injection";

interface Op<T> {
  readonly 0: T[];
  readonly 1: T[] | null | undefined;
}

// Ref derives typeName and kind from T (TypeProfile), takes pre-computed signature
type Ref<T extends TypeProfile, TSignature> = VarRef<TypeProfile.VarRefBrand<T, TSignature>>;

// Signature - pre-computed signature patterns
// depth = 0
type Signature_0 = "[TYPE_SIGNATURE]";
type Signature_1 = "[TYPE_SIGNATURE]" | null | undefined;

${embedEntries({ from: 1, to: DEPTH })`
${({ label, inner, outer }) => `type Signature_${label} = Op<Signature_${inner}>[${outer}];`}
`}

// AssignableInternal - recursive types without default value consideration
// T is TypeProfile (not WithMeta) since signature is pre-computed
// depth = 0
type AssignableInternal_0<T extends TypeProfile> = AssignableConstBase<[T, "!"]> | Ref<T, Signature_0>;
type AssignableInternal_1<T extends TypeProfile> = AssignableConstBase<[T, "?"]> | Ref<T, Signature_1>;

${embedEntries({ from: 1, to: DEPTH })`
${({ label, inner, outer, modifier }) => `type AssignableInternal_${label}<T extends TypeProfile> = Ref<T, Signature_${label}> | Op<AssignableInternal_${inner}<T>>[${outer}];`}
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
