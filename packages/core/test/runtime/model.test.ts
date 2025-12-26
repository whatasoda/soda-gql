import { describe, expect, test } from "bun:test";
import { createRuntimeModel, type RuntimeModelInput } from "../../src/runtime/model";

describe("createRuntimeModel", () => {
  const createMockInput = (
    overrides?: Partial<RuntimeModelInput["prebuild"]>,
  ): RuntimeModelInput => ({
    prebuild: {
      typename: "User",
      ...overrides,
    },
  });

  test("creates model with correct typename", () => {
    const input = createMockInput({ typename: "User" });

    const model = createRuntimeModel(input);

    expect(model.typename).toBe("User");
  });

  test("creates model with different typename", () => {
    const input = createMockInput({ typename: "Post" });

    const model = createRuntimeModel(input);

    expect(model.typename).toBe("Post");
  });

  test("has hidden embed function", () => {
    const input = createMockInput();

    const model = createRuntimeModel(input);

    // embed should be a hidden value (function)
    expect(typeof model.embed).toBe("function");
  });

  test("creates multiple models with different typenames", () => {
    const userModel = createRuntimeModel(createMockInput({ typename: "User" }));
    const postModel = createRuntimeModel(createMockInput({ typename: "Post" }));
    const commentModel = createRuntimeModel(
      createMockInput({ typename: "Comment" }),
    );

    expect(userModel.typename).toBe("User");
    expect(postModel.typename).toBe("Post");
    expect(commentModel.typename).toBe("Comment");
  });

  test("returns object with expected shape", () => {
    const input = createMockInput();

    const model = createRuntimeModel(input);

    expect(Object.keys(model)).toContain("typename");
    expect(Object.keys(model)).toContain("embed");
  });
});
