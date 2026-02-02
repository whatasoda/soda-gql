import { describe, expect, test } from "bun:test";
import { findFragmentDefinitionAtOffset, findFragmentSpreadAtOffset, findFragmentSpreadByText } from "./_utils";

describe("findFragmentSpreadAtOffset", () => {
  test("returns node when cursor is on a fragment spread", () => {
    const gql = "query Q { user { ...UserFields } }";
    const spreadIdx = gql.indexOf("...UserFields");
    const result = findFragmentSpreadAtOffset(gql, spreadIdx + 3);
    expect(result).not.toBeNull();
    expect(result!.name.value).toBe("UserFields");
  });

  test("returns node when cursor is on the spread dots", () => {
    const gql = "query Q { user { ...UserFields } }";
    const spreadIdx = gql.indexOf("...");
    const result = findFragmentSpreadAtOffset(gql, spreadIdx);
    expect(result).not.toBeNull();
    expect(result!.name.value).toBe("UserFields");
  });

  test("returns null when cursor is outside spread", () => {
    const gql = "query Q { user { ...UserFields } }";
    const result = findFragmentSpreadAtOffset(gql, 0);
    expect(result).toBeNull();
  });

  test("uses text fallback on parse errors", () => {
    const gql = "{ invalid ...UserFields";
    const spreadIdx = gql.indexOf("...UserFields");
    const result = findFragmentSpreadAtOffset(gql, spreadIdx);
    expect(result).not.toBeNull();
    expect(result!.name.value).toBe("UserFields");
  });
});

describe("findFragmentSpreadByText", () => {
  test("finds spread by text matching", () => {
    const text = "query Q { ...Frag }";
    const idx = text.indexOf("...Frag");
    const result = findFragmentSpreadByText(text, idx + 3);
    expect(result).not.toBeNull();
    expect(result!.name.value).toBe("Frag");
  });

  test("returns null when no spread at offset", () => {
    const text = "query Q { field }";
    const result = findFragmentSpreadByText(text, 0);
    expect(result).toBeNull();
  });
});

describe("findFragmentDefinitionAtOffset", () => {
  test("returns name and loc when cursor is on definition name", () => {
    const gql = "fragment UserFields on User { id name }";
    const nameIdx = gql.indexOf("UserFields");
    const result = findFragmentDefinitionAtOffset(gql, nameIdx);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("UserFields");
    expect(result!.loc.start).toBe(nameIdx);
    expect(result!.loc.end).toBe(nameIdx + "UserFields".length);
  });

  test("returns result at end of name range", () => {
    const gql = "fragment UserFields on User { id name }";
    const nameIdx = gql.indexOf("UserFields");
    // cursor at last char of name (exclusive end, so nameIdx + length - 1)
    const result = findFragmentDefinitionAtOffset(gql, nameIdx + "UserFields".length - 1);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("UserFields");
  });

  test("returns null when cursor is outside fragment name", () => {
    const gql = "fragment UserFields on User { id name }";
    const result = findFragmentDefinitionAtOffset(gql, 0);
    expect(result).toBeNull();
  });

  test("returns null for query definitions", () => {
    const gql = "query GetUser { user { id } }";
    const nameIdx = gql.indexOf("GetUser");
    const result = findFragmentDefinitionAtOffset(gql, nameIdx);
    expect(result).toBeNull();
  });

  test("returns null on parse error", () => {
    const gql = "fragment { invalid";
    const result = findFragmentDefinitionAtOffset(gql, 0);
    expect(result).toBeNull();
  });
});
