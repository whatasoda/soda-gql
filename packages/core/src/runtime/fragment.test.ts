import { describe, expect, test } from "bun:test";
import { createRuntimeFragment, type RuntimeFragmentInput } from "./fragment";

describe("createRuntimeFragment", () => {
  const createMockInput = (overrides?: Partial<RuntimeFragmentInput["prebuild"]>): RuntimeFragmentInput => ({
    prebuild: {
      typename: "User",
      ...overrides,
    },
  });

  test("creates fragment with correct typename", () => {
    const input = createMockInput({ typename: "User" });

    const fragment = createRuntimeFragment(input);

    expect(fragment.typename).toBe("User");
  });

  test("creates fragment with different typename", () => {
    const input = createMockInput({ typename: "Post" });

    const fragment = createRuntimeFragment(input);

    expect(fragment.typename).toBe("Post");
  });

  test("has hidden spread function", () => {
    const input = createMockInput();

    const fragment = createRuntimeFragment(input);

    // spread should be a hidden value (function)
    expect(typeof fragment.spread).toBe("function");
  });

  test("creates multiple fragments with different typenames", () => {
    const userFragment = createRuntimeFragment(createMockInput({ typename: "User" }));
    const postFragment = createRuntimeFragment(createMockInput({ typename: "Post" }));
    const commentFragment = createRuntimeFragment(createMockInput({ typename: "Comment" }));

    expect(userFragment.typename).toBe("User");
    expect(postFragment.typename).toBe("Post");
    expect(commentFragment.typename).toBe("Comment");
  });

  test("returns object with expected shape", () => {
    const input = createMockInput();

    const fragment = createRuntimeFragment(input);

    expect(Object.keys(fragment)).toContain("typename");
    expect(Object.keys(fragment)).toContain("spread");
  });
});
