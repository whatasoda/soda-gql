import { describe, expect, it } from "bun:test";
import { parse } from "graphql";

import { createOperationRegistry } from "../../../packages/builder/src/artifact/registry";
import { type CanonicalId, createCanonicalId } from "../../../packages/builder/src/index";

describe("canonical identifier helpers", () => {
  it("normalizes absolute file paths and export names", () => {
    const id = createCanonicalId("/app/src/../src/entities/user.ts", "userSlice");
    expect(id).toBe("/app/src/entities/user.ts::userSlice" as unknown as CanonicalId);
  });

  it("guards against relative paths", () => {
    expect(() => createCanonicalId("./user.ts", "userSlice")).toThrow("CANONICAL_ID_REQUIRES_ABSOLUTE_PATH");
  });
});

describe("operation registry", () => {
  it("registers models once and rejects duplicates", () => {
    const registry = createOperationRegistry();
    const id = createCanonicalId("/app/src/entities/user.ts", "userModel");

    const first = registry.registerModel({
      type: "model",
      id,
      prebuild: {
        typename: "User",
      },
    });

    expect(first.isOk()).toBe(true);

    const duplicate = registry.registerModel({
      type: "model",
      id,
      prebuild: {
        typename: "User",
      },
    });

    expect(duplicate.isErr()).toBe(true);
    duplicate.match(
      () => {
        throw new Error("expected duplicate registration to err");
      },
      (error) => {
        expect(error.code).toBe("ARTIFACT_ALREADY_REGISTERED");
        expect(error.id).toBe(id);
      },
    );
  });

  it("registers slices once and rejects duplicates", () => {
    const registry = createOperationRegistry();
    const id = createCanonicalId("/app/src/entities/user.ts", "userSlice");

    const first = registry.registerSlice({
      type: "slice",
      id,
      prebuild: {
        operationType: "query",
      },
    });

    expect(first.isOk()).toBe(true);

    const duplicate = registry.registerSlice({
      type: "slice",
      id,
      prebuild: {
        operationType: "query",
      },
    });

    expect(duplicate.isErr()).toBe(true);
    duplicate.match(
      () => {
        throw new Error("expected duplicate registration to err");
      },
      (error) => {
        expect(error.code).toBe("ARTIFACT_ALREADY_REGISTERED");
        expect(error.id).toBe(id);
      },
    );
  });

  it("registers operations once and rejects duplicates", () => {
    const registry = createOperationRegistry();
    const id = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

    const first = registry.registerOperation({
      type: "operation",
      id,
      prebuild: {
        operationType: "query",
        operationName: "ProfilePageQuery",
        document: parse("query ProfilePageQuery { users { id } }"),
        variableNames: [],
        projectionPathGraph: {
          matches: [],
          children: {},
        },
      },
    });

    expect(first.isOk()).toBe(true);

    const duplicate = registry.registerOperation({
      type: "operation",
      id,
      prebuild: {
        operationType: "query",
        operationName: "ProfilePageQuery",
        document: parse("query ProfilePageQuery { users { id name } }"),
        variableNames: [],
        projectionPathGraph: {
          matches: [],
          children: {},
        },
      },
    });

    expect(duplicate.isErr()).toBe(true);
    duplicate.match(
      () => {
        throw new Error("expected duplicate registration to err");
      },
      (error) => {
        expect(error.code).toBe("ARTIFACT_ALREADY_REGISTERED");
        expect(error.id).toBe(id);
      },
    );
  });

  it("provides snapshot of all registered entities", () => {
    const registry = createOperationRegistry();

    const modelId = createCanonicalId("/app/src/entities/user.ts", "userModel");
    const sliceId = createCanonicalId("/app/src/entities/user.ts", "userSlice");
    const operationId = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

    registry.registerModel({
      type: "model",
      id: modelId,
      prebuild: {
        typename: "User",
      },
    });

    registry.registerSlice({
      type: "slice",
      id: sliceId,
      prebuild: {
        operationType: "query",
      },
    });

    registry.registerOperation({
      type: "operation",
      id: operationId,
      prebuild: {
        operationName: "ProfilePageQuery",
        operationType: "query",
        document: parse("query ProfilePageQuery($userId: ID!) { users { id } }"),
        variableNames: ["userId"],
        projectionPathGraph: {
          matches: [],
          children: {},
        },
      },
    });

    const snapshot = registry.snapshot();

    const modelEntry = snapshot.artifacts[modelId];
    expect(modelEntry).toBeDefined();
    expect(modelEntry?.type).toBe("model");
    if (modelEntry?.type === "model") {
      expect(modelEntry.prebuild.typename).toBe("User");
    }

    const sliceEntry = snapshot.artifacts[sliceId];
    expect(sliceEntry).toBeDefined();
    expect(sliceEntry?.type).toBe("slice");

    const operationEntry = snapshot.artifacts[operationId];
    expect(operationEntry).toBeDefined();
    expect(operationEntry?.type).toBe("operation");
    if (operationEntry?.type === "operation") {
      expect(operationEntry.prebuild.operationName).toBe("ProfilePageQuery");
      expect(operationEntry.prebuild.variableNames).toEqual(["userId"]);
    }

    expect(snapshot.counts.models).toBe(1);
    expect(snapshot.counts.slices).toBe(1);
    expect(snapshot.counts.operations).toBe(1);
  });
});
