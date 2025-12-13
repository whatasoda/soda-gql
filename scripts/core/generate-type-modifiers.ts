interface Entry {
  key: string;
  inner: string;
  outer: string;
}

function* generateEntriesForDepth (depth: number): Generator<Entry> {
  const width = depth + 1;
  for (let i = 0; i < 2 ** width; i++) {
    const segments = i.toString(2).padStart(width, "0").split("").map((num) => num === "1" ? "!" : "?");
    yield {
      key: (segments.join("[]")),
      inner: (segments.slice(0, -1).join("[]")),
      outer: ["", segments[segments.length - 1]].join("[]"),
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

const DEPTH = 2;
const OUTPUT = "packages/core/src/types/schema/type-modifier.generated.ts";

const content = `\
type Maybe<T> = T | null | undefined;

interface Op<T> {
  "[]?": Maybe<T[]>;
  "[]!": T[];
}

declare module "./type-modifier" {
  export namespace TypeModifierNS {
    interface Modified<T> {
${embedEntries({ from: 1, to: DEPTH })`
      ${({ key, inner, outer }) => `"${key}": Op<Modified<T>["${inner}"]>["${outer}"];`}
`}
    }

    interface Assignable<T extends TypeProfile, D extends boolean, S extends SpecialValueType> {
${embedEntries({ from: 1, to: DEPTH })`
      ${({ key, inner, outer }) => `"${key}": Special<T, "${key}", D, S> | Op<Assignable<T, false, S>["${inner}"]>["${outer}"];`}
`}
    }
  }
}

export {};
`

await Bun.write(OUTPUT, content);

export {};
