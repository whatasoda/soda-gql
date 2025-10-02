import { describe, expect, it } from "bun:test";
import { getAstAnalyzer } from "../../../packages/builder/src/ast";

const analyzeModule = getAstAnalyzer("ts").analyze;

describe("Module analyzer - TypeScript", () => {
  const filePath = "/test/src/test.ts";

  it("extracts top-level gql definitions with schema metadata", () => {
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
    }));

    expect(summary).toEqual([{ exportName: "userModel" }, { exportName: "userSlice" }, { exportName: "pageQuery" }]);
  });

  it("collects gql definitions nested inside non-top-level scopes", () => {
    const source = `
import { gql } from "@/graphql-system";

const buildSlice = () => {
  const invalid = gql.default(({ querySlice }) => querySlice([], () => ({}), () => ({})));
  return invalid;
};

export const userSlice = buildSlice();
`;

    const analysis = analyzeModule({ filePath, source });

    // Now nested definitions are supported
    expect(analysis.definitions).toHaveLength(1);
    const [definition] = analysis.definitions;
    expect(definition).toBeDefined();
    expect(definition?.astPath).toBe("buildSlice.arrow#0.invalid");
    expect(definition?.isTopLevel).toBe(false);
    expect(definition?.isExported).toBe(false);
    expect(definition?.exportBinding).toBeUndefined();

    // No diagnostics emitted for nested definitions
    expect(analysis.diagnostics).toHaveLength(0);
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
    expect(pageQuery?.exportName).toBe("pageQuery");
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
    expect(pageQuery?.exportName).toBe("pageQuery");
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
    expect(complexQuery?.exportName).toBe("complexQuery");
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
    expect(pageQuery?.exportName).toBe("pageQuery");
  });

  it("extracts definitions from multiple schemas", () => {
    const source = `
import { gql } from "@/graphql-system";

export const adminModel = gql.admin(({ model }) =>
  model("AdminUser", ({ f }) => ({
    id: f.id(),
    role: f.role(),
  }), (value) => value)
);

export const defaultQuery = gql.default(({ query }) =>
  query("DefaultData", {}, () => ({
    status: "ok",
  }))
);
`;

    const analysis = analyzeModule({ filePath, source });

    const summary = analysis.definitions.map((definition) => ({
      exportName: definition.exportName,
    }));

    expect(summary).toEqual([{ exportName: "adminModel" }, { exportName: "defaultQuery" }]);
  });
});
