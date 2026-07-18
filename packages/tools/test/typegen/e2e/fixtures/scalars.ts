import { defineScalar } from "@soda-gql/core";

export const scalar = {
  ...defineScalar<"ID", string, string>("ID"),
  ...defineScalar<"String", string, string>("String"),
  ...defineScalar<"Int", number, number>("Int"),
  ...defineScalar<"Float", number, number>("Float"),
  ...defineScalar<"Boolean", boolean, boolean>("Boolean"),
  // Branded-primitive custom scalar (the common type-safe-ID codegen shape). Exercises the
  // end-to-end path: this input type flows through ScalarInput_<schema>"UUID" into the metadata
  // builder's `$var` selector proxy, which must keep branded primitives terminal (see #383).
  ...defineScalar<"UUID", string & { readonly __brand: "UUID" }, string>("UUID"),
} as const;
