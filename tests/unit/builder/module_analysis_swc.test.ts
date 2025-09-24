import { describe, expect, it } from "bun:test";

import { analyzeModule } from "../../../packages/builder/src/ast/analyze-module-swc";

describe("module analysis (swc)", () => {
  const filePath = "/app/src/entities/profile.ts";

  it("extracts top-level definitions", () => {
    const source = `
import { gql } from "@/graphql-system";

export const pageQuery = gql.query(
  "ProfilePageQuery",
  {},
  () => ({
    hello: gql.model("user", () => ({}), (value) => value)(),
  }),
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
  forIterate: gql.model(
    "user",
    ({ f }) => ({
      ...f.id(),
    }),
    (data) => data,
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
  return gql.model("user", () => ({}), (value) => value);
};
`;

    const analysis = analyzeModule({ filePath, source });
    expect(analysis.definitions).toHaveLength(0);
    expect(analysis.diagnostics).toHaveLength(1);
  });
});
