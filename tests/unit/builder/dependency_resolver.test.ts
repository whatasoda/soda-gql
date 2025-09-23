import { describe, expect, it } from "bun:test";

import { buildDependencyGraph } from "../../../packages/builder/src/dependency-graph";
import { createCanonicalId } from "../../../packages/builder/src/registry";
import type { ModuleAnalysis } from "../../../packages/builder/src/ast/analyze-module";

describe("dependency graph resolver", () => {
  const baseAnalysis = (overrides: Partial<ModuleAnalysis>): ModuleAnalysis => ({
    filePath: "/dev/null",
    sourceHash: "",
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
          kind: "model",
          exportName: "userModel",
          loc: { start: { line: 4, column: 6 }, end: { line: 8, column: 1 } },
          references: [],
        },
        {
          kind: "slice",
          exportName: "userSlice",
          loc: { start: { line: 10, column: 6 }, end: { line: 16, column: 1 } },
          references: ["userModel"],
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
          kind: "operation",
          exportName: "profileQuery",
          loc: { start: { line: 5, column: 6 }, end: { line: 13, column: 1 } },
          references: ["userSlice"],
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
      exports: [
        { kind: "named", exported: "profileQuery", local: "profileQuery", isTypeOnly: false },
      ],
    });

    const result = buildDependencyGraph([sliceModule, pageModule]);

    expect(result.isOk()).toBe(true);

    result.match(
      (graph) => {
        const sliceId = createCanonicalId("/app/src/entities/user.ts", "userSlice");
        const queryId = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

        const sliceNode = graph.get(sliceId);
        const queryNode = graph.get(queryId);

        expect(sliceNode?.dependencies).toEqual([createCanonicalId("/app/src/entities/user.ts", "userModel")]);
        expect(queryNode?.dependencies).toEqual([sliceId]);
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
          kind: "slice",
          exportName: "userSlice",
          loc: { start: { line: 4, column: 6 }, end: { line: 12, column: 1 } },
          references: [],
        },
      ],
      exports: [
        { kind: "named", exported: "userSlice", local: "userSlice", isTypeOnly: false },
      ],
    });

    const barrelModule = baseAnalysis({
      filePath: "/app/src/queries/index.ts",
      exports: [
        { kind: "reexport", exported: "userSlice", source: "../entities/user", isTypeOnly: false },
      ],
    });

    const pageModule = baseAnalysis({
      filePath: "/app/src/pages/profile.query.ts",
      definitions: [
        {
          kind: "operation",
          exportName: "profileQuery",
          loc: { start: { line: 5, column: 6 }, end: { line: 13, column: 1 } },
          references: ["userSlice"],
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
      exports: [
        { kind: "named", exported: "profileQuery", local: "profileQuery", isTypeOnly: false },
      ],
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
          kind: "slice",
          exportName: "sliceA",
          loc: { start: { line: 4, column: 6 }, end: { line: 9, column: 1 } },
          references: ["sliceB"],
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
      exports: [
        { kind: "named", exported: "sliceA", local: "sliceA", isTypeOnly: false },
      ],
    });

    const sliceBModule = baseAnalysis({
      filePath: "/app/src/entities/slice-b.ts",
      definitions: [
        {
          kind: "slice",
          exportName: "sliceB",
          loc: { start: { line: 4, column: 6 }, end: { line: 9, column: 1 } },
          references: ["sliceA"],
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
      exports: [
        { kind: "named", exported: "sliceB", local: "sliceB", isTypeOnly: false },
      ],
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
});
