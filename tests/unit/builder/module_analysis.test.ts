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

  it("captures references to imported slices and models", () => {
    const source = `
import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

export const pageQuery = gql.query(
  "ProfilePageQuery",
  { userId: gql.scalar("ID", "!") },
  ({ $ }) => ({
    users: userSlice({ id: $.userId }),
  }),
);
`;

    const analysis = analyzeModule({ filePath, source });
    const definition = analysis.definitions.find((item) => item.exportName === "pageQuery");
    expect(definition?.references).toContain("userSlice");
  });

  it("captures references across same-module definitions", () => {
    const source = `
import { gql } from "@/graphql-system";

export const sliceA = gql.querySlice([], () => ({
  echo: sliceB(),
}), () => ({}));

export const sliceB = gql.querySlice([], () => ({
  echo: sliceA(),
}), () => ({}));
`;

    const analysis = analyzeModule({ filePath, source });
    const sliceA = analysis.definitions.find((item) => item.exportName === "sliceA");
    const sliceB = analysis.definitions.find((item) => item.exportName === "sliceB");

    expect(sliceA?.references).toContain("sliceB");
    expect(sliceB?.references).toContain("sliceA");
  });

  it("captures references accessed through namespace imports", () => {
    const source = `
import { gql } from "@/graphql-system";
import * as slices from "../entities/slices";

export const pageQuery = gql.query(
  "ProfilePageQuery",
  {},
  () => ({
    first: slices.slice0(),
  }),
);
`;

    const analysis = analyzeModule({ filePath, source });
    const definition = analysis.definitions.find((item) => item.exportName === "pageQuery");
    expect(definition?.references).toContain("slice0");
  });

  it("extracts definitions from object property exports", () => {
    const source = `
import { gql } from "@/graphql-system";

export const user_remoteModel = {
  forIterate: gql.model(
    "user",
    ({ f }) => ({
      ...f.id(),
      ...f.name(),
    }),
    (data) => ({
      id: data.id,
      name: data.name,
    }),
  ),
};
`;

    const analysis = analyzeModule({ filePath, source });
    const names = analysis.definitions.map((item) => item.exportName);
    expect(names).toContain("user_remoteModel.forIterate");
    expect(analysis.diagnostics).toHaveLength(0);
  });
});
