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
import type { TypeProfile, VarRef } from "./type-modifier-extension.injection";

interface Op<T> {
  readonly 0: T[];
  readonly 1: T[] | null | undefined;
}

type Ref<TProfile extends TypeProfile.WithMeta> = VarRef<TypeProfile.AssignableVarRefMeta<TProfile>>

// Assignable
// depth = 0
type Assignable_0<T extends TypeProfile.WithMeta> = TypeProfile.AssignableType<[T[0], "!", T[2]]>;
type Assignable_1<T extends TypeProfile.WithMeta> = TypeProfile.AssignableType<[T[0], "?", T[2]]>;

${embedEntries({ from: 1, to: DEPTH })`
${({ label, inner, outer, modifier }) => `type Assignable_${label}<T extends TypeProfile.WithMeta> = Ref<[T[0], "${modifier}", T[2]]> | Op<Assignable_${inner}<[T[0], "${modifier[0]}"]>>[${outer}];`}
`}

export type GetAssignableType<T extends TypeProfile.WithMeta> =
${embedEntries({ from: 0, to: DEPTH })`
  ${({ label, modifier }) => `T[1] extends "${modifier}" ? Assignable_${label}<T> :`}
`} never;
`

await Bun.write(CORE, core_content);
await Bun.write(EXTENSION, extension_content);

export {};
