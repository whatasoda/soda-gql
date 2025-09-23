import { describe, expect, it } from "bun:test";

import { analyzeModule } from "../../../packages/builder/src/ast/analyze-module";

describe("module analysis", () => {
  const filePath = "/app/src/entities/profile.ts";

  it("extracts top-level gql definitions with kind metadata", () => {
    const source = `
import { gql } from "@/graphql-system";

export const userModel = gql.model("User", ({ f }) => ({
  id: f.id(),
}), (value) => value);

export const userSlice = gql.querySlice(
  [{ id: gql.scalar("ID", "!") }],
  ({ $, f }) => ({
    users: f.users({ id: $.id }, ({ f: nested }) => ({
      id: nested.id(),
    })),
  }),
  ({ select }) => select("$.users", (result) => result),
);

export const pageQuery = gql.query(
  "ProfilePageQuery",
  { userId: gql.scalar("ID", "!") },
  ({ $ }) => ({
    users: userSlice({ id: $.userId }),
  }),
);
`;

    const analysis = analyzeModule({ filePath, source });

    const summary = analysis.definitions.map((definition) => ({
      kind: definition.kind,
      exportName: definition.exportName,
    }));

    expect(summary).toEqual([
      { kind: "model", exportName: "userModel" },
      { kind: "slice", exportName: "userSlice" },
      { kind: "operation", exportName: "pageQuery" },
    ]);

    expect(analysis.diagnostics).toHaveLength(0);

    const [model] = analysis.definitions;
    expect(model.loc.start.line).toBe(4);
    expect(model.loc.start.column).toBeGreaterThan(0);
  });

  it("reports diagnostics when gql definitions are nested inside non-top-level scopes", () => {
    const source = `
import { gql } from "@/graphql-system";

const buildSlice = () => {
  const invalid = gql.querySlice([], () => ({}), () => ({}));
  return invalid;
};

export const userSlice = buildSlice();
`;

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toEqual([]);
    expect(analysis.diagnostics).toHaveLength(1);
    const [diagnostic] = analysis.diagnostics;
    expect(diagnostic.code).toBe("NON_TOP_LEVEL_DEFINITION");
    expect(diagnostic.loc.start.line).toBeGreaterThan(0);
    expect(diagnostic.loc.start.column).toBeGreaterThan(0);
  });
});
