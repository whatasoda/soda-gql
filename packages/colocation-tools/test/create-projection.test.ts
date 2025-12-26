import { describe, expect, it } from "bun:test";
import { Model } from "@soda-gql/core";
import {
  createExecutionResultParser,
  createProjection,
  SlicedExecutionResultError,
  SlicedExecutionResultSuccess,
} from "../src";

describe("createProjection", () => {
  // Create a mock Model for testing
  const createMockModel = () => {
    return Model.create<any, "Query", {}, { user: { id: string; name: string } }>(() => ({
      typename: "Query",
      embed: () => ({ user: { id: "1", name: "Test" } }),
    }));
  };

  it("should create a projection with paths and handle function", () => {
    const model = createMockModel();

    const projection = createProjection(model, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isError()) {
          return { error: result.error, data: null };
        }
        if (result.isEmpty()) {
          return { error: null, data: null };
        }
        const data = result.unwrap();
        return { error: null, data: { userId: data.user.id } };
      },
    });

    expect(projection.paths).toHaveLength(1);
    expect(projection.paths[0].full).toBe("$.user");
  });

  it("should handle success result correctly", () => {
    const model = createMockModel();

    const projection = createProjection(model, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isSuccess()) {
          const data = result.unwrap();
          return { userId: data.user.id, userName: data.user.name };
        }
        return null;
      },
    });

    // Simulate a success result
    const successResult = new SlicedExecutionResultSuccess({ user: { id: "1", name: "Alice" } });
    const projected = projection.projector(successResult);

    expect(projected).toEqual({ userId: "1", userName: "Alice" });
  });

  it("should handle error result correctly", () => {
    const model = createMockModel();

    const projection = createProjection(model, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isError()) {
          return { error: result.error.message, data: null };
        }
        return { error: null, data: result.unwrap() };
      },
    });

    // Simulate an error result
    const errorResult = new SlicedExecutionResultError({
      message: "User not found",
      locations: [],
      path: ["user"],
    });
    const projected = projection.projector(errorResult);

    expect(projected).toEqual({ error: "User not found", data: null });
  });
});

describe("createExecutionResultParser integration", () => {
  it("should parse execution result with labeled projections", () => {
    const userModel = Model.create<any, "Query", {}, { user: { id: string } }>(() => ({
      typename: "Query",
      embed: () => ({ user: { id: "1" } }),
    }));

    const userProjection = createProjection(userModel, {
      paths: ["$.user"],
      handle: (result) => {
        if (result.isSuccess()) {
          // The data comes as an array of values for each path
          const [userData] = result.unwrap() as [{ id: string }];
          return { userId: userData.id };
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
    const userModel = Model.create<any, "Query", {}, { user: { id: string } }>(() => ({
      typename: "Query",
      embed: () => ({ user: { id: "1" } }),
    }));

    const userProjection = createProjection(userModel, {
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
