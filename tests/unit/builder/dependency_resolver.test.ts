import { describe, expect, it } from "bun:test";
import type { ModuleAnalysis } from "../../../packages/builder/src/ast";
import { buildDependencyGraph } from "../../../packages/builder/src/dependency-graph";
import { createCanonicalId } from "../../../packages/builder/src/index";

describe("dependency graph resolver", () => {
  const baseAnalysis = (overrides: Partial<ModuleAnalysis>): ModuleAnalysis => ({
    filePath: "/dev/null",
    signature: "",
    definitions: [],
    diagnostics: [],
    imports: [],
    exports: [],
    ...overrides,
  });

  it("resolves canonical ids across imports within the same module graph", () => {
    const sliceModule = baseAnalysis({
      filePath: "/app/src/entities/user.ts",
      definitions: [
        {
          astPath: "userModel",
          isTopLevel: true,
          isExported: true,
          exportBinding: "userModel",
          loc: { start: { line: 4, column: 6 }, end: { line: 8, column: 1 } },
          expression: "gql.model('User', () => ({}), (value) => value)",
        },
        {
          astPath: "userSlice",
          isTopLevel: true,
          isExported: true,
          exportBinding: "userSlice",
          loc: { start: { line: 10, column: 6 }, end: { line: 16, column: 1 } },
          expression: "gql.querySlice([], () => ({ ...userModel.fragment() }), () => ({}))",
        },
      ],
      imports: [
        {
          source: "@/graphql-system",
          imported: "gql",
          local: "gql",
          kind: "named",
          isTypeOnly: false,
        },
      ],
      exports: [
        { kind: "named", exported: "userModel", local: "userModel", isTypeOnly: false },
        { kind: "named", exported: "userSlice", local: "userSlice", isTypeOnly: false },
      ],
    });

    const pageModule = baseAnalysis({
      filePath: "/app/src/pages/profile.query.ts",
      definitions: [
        {
          astPath: "profileQuery",
          isTopLevel: true,
          isExported: true,
          exportBinding: "profileQuery",
          loc: { start: { line: 5, column: 6 }, end: { line: 13, column: 1 } },
          expression: "gql.query('ProfilePageQuery', {}, () => ({ users: userSlice.build() }))",
        },
      ],
      imports: [
        {
          source: "../entities/user",
          imported: "userSlice",
          local: "userSlice",
          kind: "named",
          isTypeOnly: false,
        },
      ],
      exports: [{ kind: "named", exported: "profileQuery", local: "profileQuery", isTypeOnly: false }],
    });

    const result = buildDependencyGraph([sliceModule, pageModule]);

    expect(result.isOk()).toBe(true);

    result.match(
      (graph) => {
        const sliceId = createCanonicalId("/app/src/entities/user.ts", "userSlice");
        const queryId = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

        const sliceNode = graph.get(sliceId);
        const queryNode = graph.get(queryId);

        // Module-level dependency analysis doesn't track same-file dependencies
        expect(sliceNode?.dependencies).toEqual([]);
        // Module-level dependency analysis includes all gql exports from imported modules
        const modelId = createCanonicalId("/app/src/entities/user.ts", "userModel");
        expect(queryNode?.dependencies).toContain(sliceId);
        expect(queryNode?.dependencies).toContain(modelId);
      },
      () => {
        throw new Error("expected dependency graph resolution to succeed");
      },
    );
  });

  it("resolves dependencies through re-export barrels", () => {
    const sliceModule = baseAnalysis({
      filePath: "/app/src/entities/user.ts",
      definitions: [
        {
          astPath: "userSlice",
          isTopLevel: true,
          isExported: true,
          exportBinding: "userSlice",
          loc: { start: { line: 4, column: 6 }, end: { line: 12, column: 1 } },
          expression: "gql.querySlice([], () => ({}), () => ({}))",
        },
      ],
      exports: [{ kind: "named", exported: "userSlice", local: "userSlice", isTypeOnly: false }],
    });

    const barrelModule = baseAnalysis({
      filePath: "/app/src/queries/index.ts",
      exports: [{ kind: "reexport", exported: "userSlice", source: "../entities/user", isTypeOnly: false }],
    });

    const pageModule = baseAnalysis({
      filePath: "/app/src/pages/profile.query.ts",
      definitions: [
        {
          astPath: "profileQuery",
          isTopLevel: true,
          isExported: true,
          exportBinding: "profileQuery",
          loc: { start: { line: 5, column: 6 }, end: { line: 13, column: 1 } },
          expression: "gql.query('ProfilePageQuery', {}, () => ({ users: userSlice.build() }))",
        },
      ],
      imports: [
        {
          source: "../queries",
          imported: "userSlice",
          local: "userSlice",
          kind: "named",
          isTypeOnly: false,
        },
      ],
      exports: [{ kind: "named", exported: "profileQuery", local: "profileQuery", isTypeOnly: false }],
    });

    const result = buildDependencyGraph([sliceModule, barrelModule, pageModule]);

    expect(result.isOk()).toBe(true);

    result.match(
      (graph) => {
        const sliceId = createCanonicalId("/app/src/entities/user.ts", "userSlice");
        const queryId = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

        const queryNode = graph.get(queryId);
        expect(queryNode?.dependencies).toEqual([sliceId]);
      },
      () => {
        throw new Error("expected dependency graph resolution to succeed");
      },
    );
  });

  it("detects circular dependencies across canonical ids", () => {
    const sliceAModule = baseAnalysis({
      filePath: "/app/src/entities/slice-a.ts",
      definitions: [
        {
          astPath: "sliceA",
          isTopLevel: true,
          isExported: true,
          exportBinding: "sliceA",
          loc: { start: { line: 4, column: 6 }, end: { line: 9, column: 1 } },
          expression: "gql.querySlice([], () => ({ ...sliceB.fragment() }), () => ({}))",
        },
      ],
      imports: [
        {
          source: "./slice-b",
          imported: "sliceB",
          local: "sliceB",
          kind: "named",
          isTypeOnly: false,
        },
      ],
      exports: [{ kind: "named", exported: "sliceA", local: "sliceA", isTypeOnly: false }],
    });

    const sliceBModule = baseAnalysis({
      filePath: "/app/src/entities/slice-b.ts",
      definitions: [
        {
          astPath: "sliceB",
          isTopLevel: true,
          isExported: true,
          exportBinding: "sliceB",
          loc: { start: { line: 4, column: 6 }, end: { line: 9, column: 1 } },
          expression: "gql.querySlice([], () => ({ ...sliceA.fragment() }), () => ({}))",
        },
      ],
      imports: [
        {
          source: "./slice-a",
          imported: "sliceA",
          local: "sliceA",
          kind: "named",
          isTypeOnly: false,
        },
      ],
      exports: [{ kind: "named", exported: "sliceB", local: "sliceB", isTypeOnly: false }],
    });

    const result = buildDependencyGraph([sliceAModule, sliceBModule]);

    expect(result.isErr()).toBe(true);

    result.match(
      () => {
        throw new Error("expected cycle detection to fail");
      },
      (error) => {
        expect(error.code).toBe("CIRCULAR_DEPENDENCY");
        expect(error.chain).toEqual([
          createCanonicalId("/app/src/entities/slice-a.ts", "sliceA"),
          createCanonicalId("/app/src/entities/slice-b.ts", "sliceB"),
          createCanonicalId("/app/src/entities/slice-a.ts", "sliceA"),
        ]);
      },
    );
  });

  it("resolves canonical ids for object member references across modules", () => {
    const userModule = baseAnalysis({
      filePath: "/app/src/entities/user.ts",
      definitions: [
        {
          astPath: "userSliceCatalog.byId",
          isTopLevel: true,
          isExported: true,
          exportBinding: "userSliceCatalog.byId",
          loc: { start: { line: 10, column: 6 }, end: { line: 18, column: 1 } },
          expression: "gql.querySlice([], () => ({}), () => ({}))",
        },
      ],
      exports: [{ kind: "named", exported: "userSliceCatalog", local: "userSliceCatalog", isTypeOnly: false }],
    });

    const userCatalogModule = baseAnalysis({
      filePath: "/app/src/entities/user.catalog.ts",
      definitions: [
        {
          astPath: "collections.byCategory",
          isTopLevel: true,
          isExported: true,
          exportBinding: "collections.byCategory",
          loc: { start: { line: 6, column: 6 }, end: { line: 16, column: 1 } },
          expression: "gql.querySlice([], () => ({}), () => ({}))",
        },
      ],
      exports: [{ kind: "named", exported: "collections", local: "collections", isTypeOnly: false }],
    });

    const profileModule = baseAnalysis({
      filePath: "/app/src/pages/profile.query.ts",
      definitions: [
        {
          astPath: "profileQuery",
          isTopLevel: true,
          isExported: true,
          exportBinding: "profileQuery",
          loc: { start: { line: 4, column: 6 }, end: { line: 20, column: 1 } },
          expression:
            "gql.query('ProfilePageQuery', {}, () => ({ catalog: userSliceCatalog.byId.build(), collections: userCatalog.collections.byCategory.build() }))",
        },
      ],
      imports: [
        {
          source: "../entities/user",
          imported: "userSliceCatalog",
          local: "userSliceCatalog",
          kind: "named",
          isTypeOnly: false,
        },
        {
          source: "../entities/user.catalog",
          imported: "*",
          local: "userCatalog",
          kind: "namespace",
          isTypeOnly: false,
        },
      ],
      exports: [{ kind: "named", exported: "profileQuery", local: "profileQuery", isTypeOnly: false }],
    });

    const result = buildDependencyGraph([userModule, userCatalogModule, profileModule]);

    expect(result.isOk()).toBe(true);
    result.match(
      (graph) => {
        const queryId = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");
        const catalogSliceId = createCanonicalId("/app/src/entities/user.ts", "userSliceCatalog.byId");
        const userCatalogSliceId = createCanonicalId("/app/src/entities/user.catalog.ts", "collections.byCategory");

        const dependencies = graph.get(queryId)?.dependencies ?? [];
        expect(dependencies).toContain(catalogSliceId);
        expect(dependencies).toContain(userCatalogSliceId);
      },
      () => {
        throw new Error("expected dependency graph resolution to succeed");
      },
    );
  });
});
