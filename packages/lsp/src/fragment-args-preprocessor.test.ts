import { describe, expect, test } from "bun:test";
import { preprocessFragmentArgs } from "./fragment-args-preprocessor";

describe("preprocessFragmentArgs", () => {
  test("no-op for standard GraphQL without Fragment Arguments", () => {
    const content = `
  fragment UserFields on User {
    id
    name
  }
`;
    const result = preprocessFragmentArgs(content);
    expect(result.preprocessed).toBe(content);
    expect(result.modified).toBe(false);
  });

  test("strips fragment definition arguments", () => {
    const content = `fragment UserProfile($showEmail: Boolean = false) on User {
  id
  name
  email @include(if: $showEmail)
}`;
    const result = preprocessFragmentArgs(content);
    expect(result.modified).toBe(true);
    // Arguments replaced with spaces, "on User" preserved
    expect(result.preprocessed).toContain("fragment UserProfile");
    expect(result.preprocessed).toContain("on User");
    expect(result.preprocessed).not.toContain("$showEmail: Boolean");
    // Length preserved
    expect(result.preprocessed.length).toBe(content.length);
  });

  test("strips fragment spread arguments", () => {
    const content = `query GetUser($id: ID!) {
  user(id: $id) {
    ...UserProfile(showEmail: true)
  }
}`;
    const result = preprocessFragmentArgs(content);
    expect(result.modified).toBe(true);
    expect(result.preprocessed).toContain("...UserProfile");
    expect(result.preprocessed).not.toContain("showEmail: true");
    expect(result.preprocessed.length).toBe(content.length);
  });

  test("preserves line/column alignment", () => {
    const content = `fragment Foo($x: Boolean) on Bar {
  id
}`;
    const result = preprocessFragmentArgs(content);
    // Split into lines and verify line count is preserved
    const originalLines = content.split("\n");
    const processedLines = result.preprocessed.split("\n");
    expect(processedLines.length).toBe(originalLines.length);
    // Each line has the same length
    for (let i = 0; i < originalLines.length; i++) {
      expect(processedLines[i]!.length).toBe(originalLines[i]!.length);
    }
  });

  test("handles nested parens in default values", () => {
    const content = 'fragment Foo($items: [String!]! = ["a", "b"]) on Bar {\n  id\n}';
    const result = preprocessFragmentArgs(content);
    expect(result.modified).toBe(true);
    expect(result.preprocessed).toContain("on Bar");
    expect(result.preprocessed).not.toContain("[String!]!");
    expect(result.preprocessed.length).toBe(content.length);
  });

  test("handles multiple fragments", () => {
    const content = `fragment A($x: Int) on Foo {
  id
}

fragment B($y: String = "hi") on Bar {
  name
}`;
    const result = preprocessFragmentArgs(content);
    expect(result.modified).toBe(true);
    expect(result.preprocessed).toContain("on Foo");
    expect(result.preprocessed).toContain("on Bar");
    expect(result.preprocessed).not.toContain("$x: Int");
    expect(result.preprocessed).not.toContain("$y: String");
    expect(result.preprocessed.length).toBe(content.length);
  });

  test("handles fragment with multiple arguments", () => {
    const content = "fragment F($a: Int!, $b: String = \"default\") on T {\n  f\n}";
    const result = preprocessFragmentArgs(content);
    expect(result.modified).toBe(true);
    expect(result.preprocessed).toContain("on T");
    expect(result.preprocessed).not.toContain("$a: Int!");
    expect(result.preprocessed.length).toBe(content.length);
  });

  test("does not strip field arguments", () => {
    const content = `query {
  user(id: "123") {
    id
  }
}`;
    const result = preprocessFragmentArgs(content);
    expect(result.preprocessed).toBe(content);
    expect(result.modified).toBe(false);
  });

  test("does not strip directive arguments", () => {
    const content = `fragment F on User {
  email @include(if: $show)
}`;
    const result = preprocessFragmentArgs(content);
    expect(result.preprocessed).toBe(content);
    expect(result.modified).toBe(false);
  });
});
