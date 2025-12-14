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
const OUTPUT = "packages/core/src/types/type-foundation/type-modifier.generated.ts";

const content = `\
import type { TypeModifier, TypeProfile, AssignableVarRef } from "./type-modifier.injection";

type Maybe<T> = T | null | undefined;

interface Op<T> {
  0: T[];
  1: Maybe<T[]>;
}

// Modified
// depth = 0
type Modified_0<T> = T;
type Modified_1<T> = T | null | undefined;

${embedEntries({ from: 1, to: DEPTH })`
${({ label, inner, outer }) => `type Modified_${label}<T> = Op<Modified_${inner}<T>>[${outer}];`}
`}

export type GetModifiedType<T extends TypeProfile, TModifier extends TypeModifier> = ApplyTypeModifier<T["value"], TModifier>;
export type ApplyTypeModifier<T, M extends TypeModifier> =
${embedEntries({ from: 0, to: DEPTH })`
  ${({ label, modifier }) => `M extends "${modifier}" ? Modified_${label}<T> :`}
`}
  never;

type Ref<T extends TypeProfile, M extends TypeModifier, D extends boolean> = AssignableVarRef<T, M, D>;

// Assignable
// depth = 0
type Assignable_0<T extends TypeProfile, D extends boolean> = Ref<T, "!", D> | Modified_0<T["value"]>;
type Assignable_1<T extends TypeProfile, D extends boolean> = Ref<T, "?", D> | Modified_1<T["value"]>;

${embedEntries({ from: 1, to: DEPTH })`
${({ label, inner, outer, modifier }) => `type Assignable_${label}<T extends TypeProfile, D extends boolean> = Ref<T, "${modifier}", D> | Op<Assignable_${inner}<T, false>>[${outer}];`}
`}

export type GetAssignableType<T extends TypeProfile, M extends TypeModifier, D extends boolean> =
${embedEntries({ from: 0, to: DEPTH })`
  ${({ label, modifier }) => `M extends "${modifier}" ? Assignable_${label}<T, D> :`}
`}
  never;

export type ValidTypeModifier =
${embedEntries({ from: 0, to: DEPTH })`
  ${({ modifier }) => `| "${modifier}"`}
`}
`

await Bun.write(OUTPUT, content);

export {};
