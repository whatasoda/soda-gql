import { describe, expect, it } from "bun:test";
import { type AnyFragment, Fragment } from "@soda-gql/core";
import { createProjection } from "./create-projection";
import { createExecutionResultParser } from "./parse-execution-result";
import { SlicedExecutionResultError, SlicedExecutionResultSuccess } from "./sliced-execution-result";
import type { NormalizedError } from "./types";

describe("createProjection", () => {
  // Create a mock Fragment for testing
  const createMockFragment = (): AnyFragment => {
    const mockBuilder = () => ({
      typename: "Query",
      spread: () => ({ user: { id: "1", name: "Test" } }),
    });
    return Fragment.create(mockBuilder as any) as AnyFragment;
  };

  it("should create a projection with paths and handle function", () => {
    const fragment = createMockFragment();

    const projection = createProjection(fragment, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isError()) {
          return { error: result.error, data: null };
        }
        if (result.isEmpty()) {
          return { error: null, data: null };
        }
        const [user] = result.unwrap();
        return { error: null, data: { userId: user.id } };
      },
    });

    expect(projection.paths).toHaveLength(1);
    expect(projection.paths[0]!.full).toBe("$.user");
  });

  it("should handle success result correctly", () => {
    const fragment = createMockFragment();

    const projection = createProjection(fragment, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isSuccess()) {
          const [user] = result.unwrap();
          return { userId: user.id, userName: user.name };
        }
        return null;
      },
    });

    // Simulate a success result (tuple with single element for single path)
    const successResult = new SlicedExecutionResultSuccess([{ id: "1", name: "Alice" }]);
    const projected = projection.projector(successResult);

    expect(projected).toEqual({ userId: "1", userName: "Alice" });
  });

  it("should handle error result correctly", () => {
    const fragment = createMockFragment();

    const projection = createProjection(fragment, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isError()) {
          const error = result.error;
          if (error.type === "graphql-error") {
            return { error: error.errors[0]?.message ?? "Unknown error", data: null };
          }
          return { error: "Non-GraphQL error", data: null };
        }
        if (result.isEmpty()) {
          return { error: null, data: null };
        }
        const [user] = result.unwrap();
        return { error: null, data: user };
      },
    });

    // Simulate an error result
    const normalizedError: NormalizedError = {
      type: "graphql-error",
      errors: [{ message: "User not found", locations: [], path: ["user"] }],
    };
    const errorResult = new SlicedExecutionResultError(normalizedError);
    const projected = projection.projector(errorResult);

    expect(projected).toEqual({ error: "User not found", data: null });
  });
});

describe("createExecutionResultParser integration", () => {
  it("should parse execution result with labeled projections", () => {
    const mockBuilder = () => ({
      typename: "Query",
      spread: () => ({ user: { id: "1" } }),
    });
    const userFragment = Fragment.create(mockBuilder as any) as AnyFragment;

    const userProjection = createProjection(userFragment, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isSuccess()) {
          // The data comes as an array of values for each path
          const data = result.unwrap() as [{ id: string }];
          return { userId: data[0]?.id };
        }
        return null;
      },
    });

    // New simpler API: just { label: { projection } }
    const parser = createExecutionResultParser({
      userData: { projection: userProjection },
    });

    const result = parser({
      type: "graphql",
      body: {
        data: { userData_user: { id: "42" } },
        errors: undefined,
      },
    });

    // The parser should have a userData key
    expect(result).toHaveProperty("userData");
    expect(result.userData).toEqual({ userId: "42" });
  });

  it("should handle empty results", () => {
    const mockBuilder = () => ({
      typename: "Query",
      spread: () => ({ user: { id: "1" } }),
    });
    const userFragment = Fragment.create(mockBuilder as any) as AnyFragment;

    const userProjection = createProjection(userFragment, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isEmpty()) {
          return { isEmpty: true };
        }
        return { isEmpty: false };
      },
    });

    const parser = createExecutionResultParser({
      userData: { projection: userProjection },
    });

    const result = parser({
      type: "empty",
    });

    expect(result.userData).toEqual({ isEmpty: true });
  });
});
