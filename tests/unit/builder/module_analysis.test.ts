import { describe, expect, it } from "bun:test";
import { analyzeModule } from "../../../packages/builder/src/ast/analyze-module";

describe("Module analyzer - TypeScript", () => {
  const filePath = "/test/src/test.ts";

  it("extracts top-level gql definitions with kind metadata", () => {
    const source = `
import { gql } from "@/graphql-system";

export const userModel = gql.default(({ model }) =>
  model("User", ({ f }) => ({
    id: f.id(),
  }), (value) => value)
);

export const userSlice = gql.default(({ querySlice, scalar }) =>
  querySlice(
    [{ id: scalar("ID", "!") }],
    ({ $, f }) => ({
      users: f.users({ id: $.id }, ({ f: nested }) => ({
        id: nested.id(),
      })),
    }),
    ({ select }) => select("$.users", (result) => result),
  )
);

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      users: userSlice({ id: $.userId }),
    }),
  )
);
`;

    const analysis = analyzeModule({ filePath, source });

    const summary = analysis.definitions.map((definition) => ({
      exportName: definition.exportName,
      kind: definition.kind,
      schemaName: definition.schemaName,
    }));

    expect(summary).toEqual([
      { exportName: "userModel", kind: "model", schemaName: "default" },
      { exportName: "userSlice", kind: "slice", schemaName: "default" },
      { exportName: "pageQuery", kind: "operation", schemaName: "default" },
    ]);
  });

  it("reports diagnostics when gql definitions are nested inside non-top-level scopes", () => {
    const source = `
import { gql } from "@/graphql-system";

const buildSlice = () => {
  const invalid = gql.default(({ querySlice }) => querySlice([], () => ({}), () => ({})));
  return invalid;
};

export const userSlice = buildSlice();
`;

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toEqual([]);
    expect(analysis.diagnostics).toHaveLength(1);
    const [diagnostic] = analysis.diagnostics;
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.code).toBe("NON_TOP_LEVEL_DEFINITION");
    expect(diagnostic?.loc.start.line).toBeGreaterThan(0);
    expect(diagnostic?.loc.start.column).toBeGreaterThan(0);
  });

  it("captures references to imported slices and models", () => {
    const source = `
import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      users: userSlice({ id: $.userId }),
    }),
  )
);
`;

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toHaveLength(1);
    const [pageQuery] = analysis.definitions;
    expect(pageQuery).toBeDefined();
    expect(pageQuery?.references).toEqual(["userSlice"]);
  });

  it("captures nested dependencies for slices", () => {
    const source = `
import { gql } from "@/graphql-system";
import * as user from "../entities/user";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      profile: user.slice.findById({ id: $.userId }),
    }),
  )
);
`;

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toHaveLength(1);
    const [pageQuery] = analysis.definitions;
    expect(pageQuery).toBeDefined();
    expect(pageQuery?.references).toContain("user.slice.findById");
  });

  it("captures references in nested object values", () => {
    const source = `
import { gql } from "@/graphql-system";
import { userSlice, postSlice } from "../entities";

export const complexQuery = gql.default(({ query, scalar }) =>
  query(
    "ComplexQuery",
    {
      userId: scalar("ID", "!"),
      postId: scalar("ID", "!"),
    },
    ({ $ }) => ({
      result: {
        user: userSlice({ id: $.userId }),
        post: postSlice({ id: $.postId }),
      },
    }),
  )
);
`;

    const analysis = analyzeModule({ filePath, source });

    expect(analysis.definitions).toHaveLength(1);
    const [complexQuery] = analysis.definitions;
    expect(complexQuery).toBeDefined();
    expect(complexQuery?.references).toEqual(["userSlice", "postSlice"]);
  });

  it("captures both local and imported dependencies", () => {
    const source = `
import { gql } from "@/graphql-system";
import { userSlice } from "../entities/user";

export const postSlice = gql.default(({ querySlice, scalar }) =>
  querySlice(
    [{ postId: scalar("ID", "!") }],
    ({ $, f }) => ({
      posts: f.posts({ id: $.postId }, ({ f }) => f.id()),
    }),
    ({ select }) => select("$.posts", (result) => result),
  )
);

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "PageQuery",
    {
      userId: scalar("ID", "!"),
      postId: scalar("ID", "!"),
    },
    ({ $ }) => ({
      user: userSlice({ id: $.userId }),
      post: postSlice({ postId: $.postId }),
    }),
  )
);
`;

    const analysis = analyzeModule({ filePath, source });

    const pageQuery = analysis.definitions.find((def) => def.exportName === "pageQuery");
    expect(pageQuery?.references).toEqual(["userSlice", "postSlice"]);
  });

  it("detects multi-schema usage with named schemas", () => {
    const source = `
import { gql } from "@/graphql-system";

export const adminModel = gql.admin(({ model }) =>
  model("AdminUser", ({ f }) => ({
    id: f.id(),
    role: f.role(),
  }), (value) => value)
);

export const publicQuery = gql.public(({ query }) =>
  query("PublicData", {}, () => ({
    status: "ok",
  }))
);
`;

    const analysis = analyzeModule({ filePath, source });

    const summary = analysis.definitions.map((definition) => ({
      exportName: definition.exportName,
      kind: definition.kind,
      schemaName: definition.schemaName,
    }));

    expect(summary).toEqual([
      { exportName: "adminModel", kind: "model", schemaName: "admin" },
      { exportName: "publicQuery", kind: "operation", schemaName: "public" },
    ]);
  });
});
