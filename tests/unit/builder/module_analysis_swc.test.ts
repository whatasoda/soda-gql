import { describe, expect, it } from "bun:test";

import { analyzeModule } from "../../../packages/builder/src/ast/analyze-module-swc";

describe("module analysis (swc)", () => {
  const filePath = "/app/src/entities/profile.ts";

  it("extracts top-level definitions", () => {
    const source = `
import { gql } from "@/graphql-system";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    {},
    () => ({
      hello: "world",
    }),
  )
);
`;

    const analysis = analyzeModule({ filePath, source });
    const names = analysis.definitions.map((item) => item.exportName);
    expect(names).toContain("pageQuery");
  });

  it("extracts definitions from object property exports", () => {
    const source = `
import { gql } from "@/graphql-system";

export const user_remoteModel = {
  forIterate: gql.default(({ model }) =>
    model(
      "user",
      ({ f }) => ({
        ...f.id(),
      }),
      (data) => data,
    )
  ),
};
`;

    const analysis = analyzeModule({ filePath, source });
    const names = analysis.definitions.map((item) => item.exportName);
    expect(names).toContain("user_remoteModel.forIterate");
    expect(analysis.diagnostics).toHaveLength(0);
  });

  it("reports diagnostics for non-top-level definitions", () => {
    const source = `
import { gql } from "@/graphql-system";

export const factory = () => {
  return gql.default(({ model }) =>
    model("user", () => ({}), (value) => value)
  );
};
`;

    const analysis = analyzeModule({ filePath, source });
    expect(analysis.definitions).toHaveLength(0);
    expect(analysis.diagnostics).toHaveLength(1);
  });

  it("captures references to properties on imported bindings", () => {
    const source = `
import { gql } from "@/graphql-system";
import { userSliceCatalog } from "../entities/user";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      catalog: userSliceCatalog.byId({ id: $.userId }),
    }),
  )
);
`;

    const analysis = analyzeModule({ filePath, source });
    const definition = analysis.definitions.find((item) => item.exportName === "pageQuery");
    expect(definition?.references).toContain("userSliceCatalog.byId");
  });

  it("captures deep member references from namespace imports", () => {
    const source = `
import { gql } from "@/graphql-system";
import * as userCatalog from "../entities/user.catalog";

export const pageQuery = gql.default(({ query, scalar }) =>
  query(
    "ProfilePageQuery",
    { userId: scalar("ID", "!") },
    ({ $ }) => ({
      catalogUsers: userCatalog.collections.byCategory({ categoryId: $.userId }),
    }),
  )
);
`;

    const analysis = analyzeModule({ filePath, source });
    const definition = analysis.definitions.find((item) => item.exportName === "pageQuery");
    expect(definition?.references).toContain("userCatalog.collections.byCategory");
  });
});
