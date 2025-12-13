type Maybe<T> = T | null | undefined;

interface Op<T> {
  "[]?": Maybe<T[]>;
  "[]!": T[];
}

declare module "./type-modifier" {
  export namespace TypeModifierNS {
    interface Modified<T> {
      // depth = 1
      "?[]?": Op<Modified<T>["?"]>["[]?"];
      "?[]!": Op<Modified<T>["?"]>["[]!"];
      "![]?": Op<Modified<T>["!"]>["[]?"];
      "![]!": Op<Modified<T>["!"]>["[]!"];

      // depth = 2
      "?[]?[]?": Op<Modified<T>["?[]?"]>["[]?"];
      "?[]?[]!": Op<Modified<T>["?[]?"]>["[]!"];
      "?[]![]?": Op<Modified<T>["?[]!"]>["[]?"];
      "?[]![]!": Op<Modified<T>["?[]!"]>["[]!"];
      "![]?[]?": Op<Modified<T>["![]?"]>["[]?"];
      "![]?[]!": Op<Modified<T>["![]?"]>["[]!"];
      "![]![]?": Op<Modified<T>["![]!"]>["[]?"];
      "![]![]!": Op<Modified<T>["![]!"]>["[]!"];

      // depth = 3
      "?[]?[]?[]?": Op<Modified<T>["?[]?[]?"]>["[]?"];
      "?[]?[]?[]!": Op<Modified<T>["?[]?[]?"]>["[]!"];
      "?[]?[]![]?": Op<Modified<T>["?[]?[]!"]>["[]?"];
      "?[]?[]![]!": Op<Modified<T>["?[]?[]!"]>["[]!"];
      "?[]![]?[]?": Op<Modified<T>["?[]![]?"]>["[]?"];
      "?[]![]?[]!": Op<Modified<T>["?[]![]?"]>["[]!"];
      "?[]![]![]?": Op<Modified<T>["?[]![]!"]>["[]?"];
      "?[]![]![]!": Op<Modified<T>["?[]![]!"]>["[]!"];
      "![]?[]?[]?": Op<Modified<T>["![]?[]?"]>["[]?"];
      "![]?[]?[]!": Op<Modified<T>["![]?[]?"]>["[]!"];
      "![]?[]![]?": Op<Modified<T>["![]?[]!"]>["[]?"];
      "![]?[]![]!": Op<Modified<T>["![]?[]!"]>["[]!"];
      "![]![]?[]?": Op<Modified<T>["![]![]?"]>["[]?"];
      "![]![]?[]!": Op<Modified<T>["![]![]?"]>["[]!"];
      "![]![]![]?": Op<Modified<T>["![]![]!"]>["[]?"];
      "![]![]![]!": Op<Modified<T>["![]![]!"]>["[]!"];
    }

    interface Assignable<T extends TypeProfile, D extends boolean, S extends SpecialValueType> {
      // depth = 1
      "?[]?": Special<T, "?[]?", D, S> | Op<Assignable<T, false, S>["?"]>["[]?"];
      "?[]!": Special<T, "?[]!", D, S> | Op<Assignable<T, false, S>["?"]>["[]!"];
      "![]?": Special<T, "![]?", D, S> | Op<Assignable<T, false, S>["!"]>["[]?"];
      "![]!": Special<T, "![]!", D, S> | Op<Assignable<T, false, S>["!"]>["[]!"];

      // depth = 2
      "?[]?[]?": Special<T, "?[]?[]?", D, S> | Op<Assignable<T, false, S>["?[]?"]>["[]?"];
      "?[]?[]!": Special<T, "?[]?[]!", D, S> | Op<Assignable<T, false, S>["?[]?"]>["[]!"];
      "?[]![]?": Special<T, "?[]![]?", D, S> | Op<Assignable<T, false, S>["?[]!"]>["[]?"];
      "?[]![]!": Special<T, "?[]![]!", D, S> | Op<Assignable<T, false, S>["?[]!"]>["[]!"];
      "![]?[]?": Special<T, "![]?[]?", D, S> | Op<Assignable<T, false, S>["![]?"]>["[]?"];
      "![]?[]!": Special<T, "![]?[]!", D, S> | Op<Assignable<T, false, S>["![]?"]>["[]!"];
      "![]![]?": Special<T, "![]![]?", D, S> | Op<Assignable<T, false, S>["![]!"]>["[]?"];
      "![]![]!": Special<T, "![]![]!", D, S> | Op<Assignable<T, false, S>["![]!"]>["[]!"];

      // depth = 3
      "?[]?[]?[]?": Special<T, "?[]?[]?[]?", D, S> | Op<Assignable<T, false, S>["?[]?[]?"]>["[]?"];
      "?[]?[]?[]!": Special<T, "?[]?[]?[]!", D, S> | Op<Assignable<T, false, S>["?[]?[]?"]>["[]!"];
      "?[]?[]![]?": Special<T, "?[]?[]![]?", D, S> | Op<Assignable<T, false, S>["?[]?[]!"]>["[]?"];
      "?[]?[]![]!": Special<T, "?[]?[]![]!", D, S> | Op<Assignable<T, false, S>["?[]?[]!"]>["[]!"];
      "?[]![]?[]?": Special<T, "?[]![]?[]?", D, S> | Op<Assignable<T, false, S>["?[]![]?"]>["[]?"];
      "?[]![]?[]!": Special<T, "?[]![]?[]!", D, S> | Op<Assignable<T, false, S>["?[]![]?"]>["[]!"];
      "?[]![]![]?": Special<T, "?[]![]![]?", D, S> | Op<Assignable<T, false, S>["?[]![]!"]>["[]?"];
      "?[]![]![]!": Special<T, "?[]![]![]!", D, S> | Op<Assignable<T, false, S>["?[]![]!"]>["[]!"];
      "![]?[]?[]?": Special<T, "![]?[]?[]?", D, S> | Op<Assignable<T, false, S>["![]?[]?"]>["[]?"];
      "![]?[]?[]!": Special<T, "![]?[]?[]!", D, S> | Op<Assignable<T, false, S>["![]?[]?"]>["[]!"];
      "![]?[]![]?": Special<T, "![]?[]![]?", D, S> | Op<Assignable<T, false, S>["![]?[]!"]>["[]?"];
      "![]?[]![]!": Special<T, "![]?[]![]!", D, S> | Op<Assignable<T, false, S>["![]?[]!"]>["[]!"];
      "![]![]?[]?": Special<T, "![]![]?[]?", D, S> | Op<Assignable<T, false, S>["![]![]?"]>["[]?"];
      "![]![]?[]!": Special<T, "![]![]?[]!", D, S> | Op<Assignable<T, false, S>["![]![]?"]>["[]!"];
      "![]![]![]?": Special<T, "![]![]![]?", D, S> | Op<Assignable<T, false, S>["![]![]!"]>["[]?"];
      "![]![]![]!": Special<T, "![]![]![]!", D, S> | Op<Assignable<T, false, S>["![]![]!"]>["[]!"];
    }
  }
}

export {};
