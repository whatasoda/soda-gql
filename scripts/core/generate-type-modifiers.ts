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
    const segments = label.split("").map((num) => num === "1" ? "?" : "!");
    yield {
      label,
      inner: label.slice(0, -1),
      outer: label.slice(-1),
      modifier: segments.join("[]"),
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
const OUTPUT = "packages/core/src/types/schema/type-modifier.generated.ts";

const content = `\
type Maybe<T> = T | null | undefined;

interface Op<T> {
  0: T[];
  1: Maybe<T[]>;
}

declare module "./type-modifier" {
  export namespace TypeModifierNS {
    namespace Modified_ {
      // depth = 0
      export type _0<T> = T;
      export type _1<T> = T | null | undefined;

${embedEntries({ from: 1, to: DEPTH })`
      ${({ label, inner, outer }) => `export type _${label}<T> = Op<_${inner}<T>>[${outer}];`}
`}
    }

    export type Modified__<T, M extends TypeModifier> =
${embedEntries({ from: 0, to: DEPTH })`
      ${({ label, modifier }) => `M extends "${modifier}" ? Modified_._${label}<T> :`}
`}
      never;

    namespace Assignable_ {
      // depth = 0
      export type _0<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "!", D, S> | Modified_._0<T["value"]>;
      export type _1<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "?", D, S> | Modified_._1<T["value"]>;
    
${embedEntries({ from: 1, to: DEPTH })`
      ${({ label, inner, outer, modifier }) => `export type _${label}<T extends TypeProfile, D extends boolean, S extends SpecialValueType> = Special<T, "${modifier}", D, S> | Op<_${inner}<T, false, S>>[${outer}];`}
`}
    }

    export type Assignable__<T extends TypeProfile, D extends boolean, S extends SpecialValueType, M extends TypeModifier> =
${embedEntries({ from: 0, to: DEPTH })`
      ${({ label, modifier }) => `M extends "${modifier}" ? Assignable_._${label}<T, D, S> :`}
`}
      never;

    export type ValidTypeModifier =
${embedEntries({ from: 0, to: DEPTH })`
        ${({ modifier }) => `| "${modifier}"`}
`}
  }

}

export {};
`

await Bun.write(OUTPUT, content);

export {};
