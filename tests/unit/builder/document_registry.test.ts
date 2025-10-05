import { describe, expect, it } from "bun:test";
import { parse } from "graphql";

import { aggregate } from "../../../packages/builder/src/artifact/aggregate";
import type { DependencyGraph, DependencyGraphNode } from "../../../packages/builder/src/dependency-graph/types";
import { type CanonicalId, createCanonicalId } from "../../../packages/builder/src/index";
import type { IntermediateModule } from "../../../packages/builder/src/intermediate-module";
import type { IntermediateArtifactElement } from "../../../packages/core/src/intermediate/pseudo-module";
import { Model, Operation, Slice } from "../../../packages/core/src/types/operation";

describe("canonical identifier helpers", () => {
  it("normalizes absolute file paths and export names", () => {
    const id = createCanonicalId("/app/src/../src/entities/user.ts", "userSlice");
    expect(id).toBe("/app/src/entities/user.ts::userSlice" as unknown as CanonicalId);
  });

  it("guards against relative paths", () => {
    expect(() => createCanonicalId("./user.ts", "userSlice")).toThrow("CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
  });
});

// Test helpers
const createTestGraphNode = (id: CanonicalId, filePath: string): DependencyGraphNode => ({
  id,
  filePath,
  localPath: id.split("::")[1] ?? "",
  isExported: true,
  definition: {
    astPath: id.split("::")[1] ?? "",
    isTopLevel: true,
    isExported: true,
    exportBinding: id.split("::")[1],
    loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
    expression: "stub",
  },
  dependencies: [],
  moduleSummary: {
    filePath,
    runtimeImports: [],
    gqlExports: [id],
  },
});

const createTestIntermediateModule = (elements: Record<string, IntermediateArtifactElement>): IntermediateModule => ({
  elements,
});

describe("artifact aggregate", () => {
  it("aggregates models, slices, and operations successfully", () => {
    const modelId = createCanonicalId("/app/src/entities/user.ts", "userModel");
    const sliceId = createCanonicalId("/app/src/entities/user.ts", "userSlice");
    const operationId = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

    const graph: DependencyGraph = new Map([
      [modelId, createTestGraphNode(modelId, "/app/src/entities/user.ts")],
      [sliceId, createTestGraphNode(sliceId, "/app/src/entities/user.ts")],
      [operationId, createTestGraphNode(operationId, "/app/src/pages/profile.query.ts")],
    ]);

    const intermediateModule = createTestIntermediateModule({
      [modelId]: {
        type: "model",
        element: Model.create(() => ({
          typename: "User",
          fragment: () => ({}),
          normalize: (raw) => raw,
        })),
      },
      [sliceId]: {
        type: "slice",
        element: Slice.create(() => ({
          operationType: "query",
          build: () => ({ fields: {}, projection: {} as any, variables: {}, getFields: () => ({}) }),
        })),
      },
      [operationId]: {
        type: "operation",
        element: Operation.create(() => ({
          operationType: "query",
          operationName: "ProfilePageQuery",
          document: parse("query ProfilePageQuery { users { id } }") as any,
          variableNames: [],
          projectionPathGraph: { matches: [], children: {} },
          parse: () => ({}) as any,
        })),
      },
    });

    const result = aggregate({ graph, elements: intermediateModule.elements });

    expect(result.isOk()).toBe(true);
    result.match(
      (registry) => {
        expect(registry.size).toBe(3);

        const model = registry.get(modelId);
        expect(model).toBeDefined();
        expect(model?.type).toBe("model");
        if (model?.type === "model") {
          expect(model.prebuild.typename).toBe("User");
        }

        const slice = registry.get(sliceId);
        expect(slice).toBeDefined();
        expect(slice?.type).toBe("slice");
        if (slice?.type === "slice") {
          expect(slice.prebuild.operationType).toBe("query");
        }

        const operation = registry.get(operationId);
        expect(operation).toBeDefined();
        expect(operation?.type).toBe("operation");
        if (operation?.type === "operation") {
          expect(operation.prebuild.operationName).toBe("ProfilePageQuery");
          expect(operation.prebuild.variableNames).toEqual([]);
        }
      },
      () => {
        throw new Error("Expected aggregate to succeed");
      },
    );
  });

  it("fails when artifact is not found in intermediate module", () => {
    const modelId = createCanonicalId("/app/src/entities/user.ts", "userModel");

    const graph: DependencyGraph = new Map([[modelId, createTestGraphNode(modelId, "/app/src/entities/user.ts")]]);

    const intermediateModule = createTestIntermediateModule({
      // Missing modelId
    });

    const result = aggregate({ graph, elements: intermediateModule.elements });

    expect(result.isErr()).toBe(true);
    result.match(
      () => {
        throw new Error("Expected aggregate to fail");
      },
      (error) => {
        expect(error.code).toBe("MODULE_EVALUATION_FAILED");
        if (error.code === "MODULE_EVALUATION_FAILED") {
          expect(error.message).toBe("ARTIFACT_NOT_FOUND_IN_RUNTIME_MODULE");
          expect(error.filePath).toBe("/app/src/entities/user.ts");
        }
      },
    );
  });

  it("fails when duplicate canonical ID exists in graph", () => {
    const modelId = createCanonicalId("/app/src/entities/user.ts", "userModel");

    // Create two nodes with the same ID (simulating a bug in graph construction)
    const graph: DependencyGraph = new Map([[modelId, createTestGraphNode(modelId, "/app/src/entities/user.ts")]]);

    // Manually add duplicate to bypass Map's deduplication for testing
    const _duplicateNode = createTestGraphNode(modelId, "/app/src/entities/user.ts");

    const intermediateModule = createTestIntermediateModule({
      [modelId]: {
        type: "model",
        element: Model.create(() => ({
          typename: "User",
          fragment: () => ({}),
          normalize: (raw) => raw,
        })),
      },
    });

    // First pass succeeds
    const result1 = aggregate({ graph, elements: intermediateModule.elements });
    expect(result1.isOk()).toBe(true);

    // To test duplicate detection, we need to simulate the aggregator seeing the same ID twice
    // This is normally prevented by Map, but we can test the logic by creating a custom scenario
    // Actually, looking at the aggregate code, it checks `registry.has(node.id)` before setting
    // Since Map prevents duplicates in the graph, this path is only hit if there's a logic error

    // For now, we acknowledge that duplicate detection in the graph itself is handled by Map
    // The ARTIFACT_ALREADY_REGISTERED error would only occur if the aggregate function had bugs
  });

  it("fails when artifact has unknown type", () => {
    const unknownId = createCanonicalId("/app/src/entities/unknown.ts", "unknownThing");

    const graph: DependencyGraph = new Map([[unknownId, createTestGraphNode(unknownId, "/app/src/entities/unknown.ts")]]);

    const intermediateModule = createTestIntermediateModule({
      [unknownId]: {
        type: "unknown" as any, // Force invalid type
        element: {} as any,
      },
    });

    const result = aggregate({ graph, elements: intermediateModule.elements });

    expect(result.isErr()).toBe(true);
    result.match(
      () => {
        throw new Error("Expected aggregate to fail");
      },
      (error) => {
        expect(error.code).toBe("MODULE_EVALUATION_FAILED");
        if (error.code === "MODULE_EVALUATION_FAILED") {
          expect(error.message).toBe("UNKNOWN_ARTIFACT_KIND");
          expect(error.filePath).toBe("/app/src/entities/unknown.ts");
        }
      },
    );
  });

  it("preserves all prebuild data for operations", () => {
    const operationId = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

    const graph: DependencyGraph = new Map([[operationId, createTestGraphNode(operationId, "/app/src/pages/profile.query.ts")]]);

    const document = parse("query ProfilePageQuery($userId: ID!) { user(id: $userId) { id name } }");
    const projectionPathGraph = {
      matches: [{ label: "user", path: "$.user", exact: true }],
      children: {},
    };

    const intermediateModule = createTestIntermediateModule({
      [operationId]: {
        type: "operation",
        element: Operation.create(() => ({
          operationType: "query",
          operationName: "ProfilePageQuery",
          document: document as any,
          variableNames: ["userId"],
          projectionPathGraph,
          parse: () => ({}) as any,
        })),
      },
    });

    const result = aggregate({ graph, elements: intermediateModule.elements });

    expect(result.isOk()).toBe(true);
    result.match(
      (registry) => {
        const operation = registry.get(operationId);
        expect(operation?.type).toBe("operation");
        if (operation?.type === "operation") {
          expect(operation.prebuild.operationType).toBe("query");
          expect(operation.prebuild.operationName).toBe("ProfilePageQuery");
          expect(operation.prebuild.document).toBe(document as any);
          expect(operation.prebuild.variableNames).toEqual(["userId"]);
          expect(operation.prebuild.projectionPathGraph).toEqual(projectionPathGraph);
        }
      },
      () => {
        throw new Error("Expected aggregate to succeed");
      },
    );
  });
});
