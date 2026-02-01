import { describe, expect, test } from "bun:test";
import { computeLineOffsets, createPositionMapper, offsetToPosition, positionToOffset } from "./position-mapping";

describe("computeLineOffsets", () => {
  test("single line returns [0]", () => {
    expect(computeLineOffsets("hello")).toEqual([0]);
  });

  test("multi-line computes correct offsets", () => {
    expect(computeLineOffsets("ab\ncd\nef")).toEqual([0, 3, 6]);
  });

  test("empty string returns [0]", () => {
    expect(computeLineOffsets("")).toEqual([0]);
  });
});

describe("positionToOffset / offsetToPosition", () => {
  const source = "ab\ncd\nef";
  const offsets = computeLineOffsets(source);

  test("line 0, char 0 -> offset 0", () => {
    expect(positionToOffset(offsets, { line: 0, character: 0 })).toBe(0);
  });

  test("line 1, char 1 -> offset 4", () => {
    expect(positionToOffset(offsets, { line: 1, character: 1 })).toBe(4);
  });

  test("offset 4 -> line 1, char 1", () => {
    expect(offsetToPosition(offsets, 4)).toEqual({ line: 1, character: 1 });
  });

  test("offset 0 -> line 0, char 0", () => {
    expect(offsetToPosition(offsets, 0)).toEqual({ line: 0, character: 0 });
  });

  test("out-of-bounds line returns -1", () => {
    expect(positionToOffset(offsets, { line: 10, character: 0 })).toBe(-1);
  });
});

describe("createPositionMapper", () => {
  test("maps TS position to GraphQL position for multi-line template", () => {
    // Simulates:
    // line 0: const q = gql.default(({ query }) => query`
    // line 1:   query GetUser {
    // line 2:     user { id }
    // line 3:   }
    // line 4: `);
    const tsSource = "const q = gql.default(({ query }) => query`\n  query GetUser {\n    user { id }\n  }\n`);";
    const contentStartOffset = 43; // position after the backtick on line 0
    const graphqlContent = "\n  query GetUser {\n    user { id }\n  }\n";

    const mapper = createPositionMapper({ tsSource, contentStartOffset, graphqlContent });

    // TS line 1, char 2 ("query") -> GraphQL line 1, char 2
    const gqlPos = mapper.tsToGraphql({ line: 1, character: 2 });
    expect(gqlPos).toEqual({ line: 1, character: 2 });

    // TS line 2, char 4 ("user") -> GraphQL line 2, char 4
    const gqlPos2 = mapper.tsToGraphql({ line: 2, character: 4 });
    expect(gqlPos2).toEqual({ line: 2, character: 4 });
  });

  test("maps GraphQL position back to TS position", () => {
    const tsSource = "const q = gql.default(({ query }) => query`\n  query GetUser {\n    user { id }\n  }\n`);";
    const contentStartOffset = 43;
    const graphqlContent = "\n  query GetUser {\n    user { id }\n  }\n";

    const mapper = createPositionMapper({ tsSource, contentStartOffset, graphqlContent });

    // GraphQL line 1, char 2 -> TS line 1, char 2
    const tsPos = mapper.graphqlToTs({ line: 1, character: 2 });
    expect(tsPos).toEqual({ line: 1, character: 2 });
  });

  test("round-trip: tsToGraphql -> graphqlToTs preserves position", () => {
    const tsSource = "const q = gql.default(({ query }) => query`\n  query GetUser {\n    user { id }\n  }\n`);";
    const contentStartOffset = 43;
    const graphqlContent = "\n  query GetUser {\n    user { id }\n  }\n";

    const mapper = createPositionMapper({ tsSource, contentStartOffset, graphqlContent });

    const original = { line: 2, character: 4 };
    const gql = mapper.tsToGraphql(original);
    expect(gql).toEqual({ line: 2, character: 4 });
    const roundTrip = mapper.graphqlToTs(gql!);
    expect(roundTrip).toEqual(original);
  });

  test("returns null for position before template", () => {
    const tsSource = "const q = gql.default(({ query }) => query`\nquery { user }\n`);";
    const contentStartOffset = 43;
    const graphqlContent = "\nquery { user }\n";

    const mapper = createPositionMapper({ tsSource, contentStartOffset, graphqlContent });

    // Line 0, char 0 is before the template
    const result = mapper.tsToGraphql({ line: 0, character: 0 });
    expect(result).toBeNull();
  });

  test("returns null for position after template", () => {
    const tsSource = "const q = gql.default(({ query }) => query`\nquery { user }\n`);";
    const contentStartOffset = 43;
    const graphqlContent = "\nquery { user }\n";

    const mapper = createPositionMapper({ tsSource, contentStartOffset, graphqlContent });

    // Position well past end of template
    const result = mapper.tsToGraphql({ line: 0, character: 100 });
    expect(result).toBeNull();
  });

  test("single-line template mapping", () => {
    const tsSource = "const q = gql.default(({ query }) => query`query { user { id } }`);";
    const contentStartOffset = 43;
    const graphqlContent = "query { user { id } }";

    const mapper = createPositionMapper({ tsSource, contentStartOffset, graphqlContent });

    // TS line 0, char 43 -> GraphQL line 0, char 0
    const gqlPos = mapper.tsToGraphql({ line: 0, character: 43 });
    expect(gqlPos).toEqual({ line: 0, character: 0 });

    // TS line 0, char 49 -> GraphQL line 0, char 6 ("{ user")
    const gqlPos2 = mapper.tsToGraphql({ line: 0, character: 49 });
    expect(gqlPos2).toEqual({ line: 0, character: 6 });
  });
});
