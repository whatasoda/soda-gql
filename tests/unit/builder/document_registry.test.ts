import { describe, expect, it } from "bun:test";
import { parse } from "graphql";

import { type CanonicalId, createCanonicalId, createOperationRegistry } from "../../../packages/builder/src/registry";

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
      id,
      prebuild: {
        typename: "User",
      },
      dependencies: [],
    });

    expect(first.isOk()).toBe(true);

    const duplicate = registry.registerModel({
      id,
      prebuild: {
        typename: "User",
      },
      dependencies: [],
    });

    expect(duplicate.isErr()).toBe(true);
    duplicate.match(
      () => {
        throw new Error("expected duplicate registration to err");
      },
      (error) => {
        expect(error.code).toBe("MODEL_ALREADY_REGISTERED");
        expect(error.id).toBe(id);
      },
    );
  });

  it("registers slices once and rejects duplicates", () => {
    const registry = createOperationRegistry();
    const id = createCanonicalId("/app/src/entities/user.ts", "userSlice");

    const first = registry.registerSlice({
      id,
      prebuild: null,
      dependencies: [],
    });

    expect(first.isOk()).toBe(true);

    const duplicate = registry.registerSlice({
      id,
      prebuild: null,
      dependencies: [],
    });

    expect(duplicate.isErr()).toBe(true);
    duplicate.match(
      () => {
        throw new Error("expected duplicate registration to err");
      },
      (error) => {
        expect(error.code).toBe("SLICE_ALREADY_REGISTERED");
        expect(error.id).toBe(id);
      },
    );
  });

  it("registers operations once and rejects duplicates", () => {
    const registry = createOperationRegistry();
    const id = createCanonicalId("/app/src/pages/profile.query.ts", "profileQuery");

    const first = registry.registerOperation({
      id,
      prebuild: {
        name: "ProfilePageQuery",
        document: parse("query ProfilePageQuery { users { id } }"),
        variableNames: [],
        projectionPathGraph: {
          matches: [],
          children: {},
        },
      },
      dependencies: [],
    });

    expect(first.isOk()).toBe(true);

    const duplicate = registry.registerOperation({
      id,
      prebuild: {
        name: "ProfilePageQuery",
        document: parse("query ProfilePageQuery { users { id name } }"),
        variableNames: [],
        projectionPathGraph: {
          matches: [],
          children: {},
        },
      },
      dependencies: [],
    });

    expect(duplicate.isErr()).toBe(true);
    duplicate.match(
      () => {
        throw new Error("expected duplicate registration to err");
      },
      (error) => {
        expect(error.code).toBe("OPERATION_ALREADY_REGISTERED");
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
      id: modelId,
      prebuild: {
        typename: "User",
      },
      dependencies: [],
    });

    registry.registerSlice({
      id: sliceId,
      prebuild: null,
      dependencies: [modelId],
    });

    registry.registerOperation({
      id: operationId,
      prebuild: {
        name: "ProfilePageQuery",
        document: parse("query ProfilePageQuery($userId: ID!) { users { id } }"),
        variableNames: ["userId"],
        projectionPathGraph: {
          matches: [],
          children: {},
        },
      },
      dependencies: [sliceId],
    });

    const snapshot = registry.snapshot();

    expect(snapshot.models[modelId]).toBeDefined();
    expect(snapshot.models[modelId]?.prebuild.typename).toBe("User");

    expect(snapshot.slices[sliceId]).toBeDefined();
    expect(snapshot.slices[sliceId]?.dependencies).toEqual([modelId]);

    expect(snapshot.operations[operationId]).toBeDefined();
    expect(snapshot.operations[operationId]?.prebuild.name).toBe("ProfilePageQuery");
    expect(snapshot.operations[operationId]?.prebuild.variableNames).toEqual(["userId"]);
    expect(snapshot.operations[operationId]?.dependencies).toEqual([sliceId]);
  });
});