import { describe, expect, test } from "bun:test";
import {
	findFragmentDefinitionAtOffset,
	findFragmentSpreadAtOffset,
	findFragmentSpreadByText,
	gqlPositionToOffset,
} from "./_utils";

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

describe("gqlPositionToOffset", () => {
	test("converts single-line position", () => {
		const content = "query Q { id }";
		const offset = gqlPositionToOffset(content, { line: 0, character: 6 });
		expect(offset).toBe(6);
	});

	test("converts multi-line position", () => {
		const content = "query Q {\n  id\n  name\n}";
		// line 1, char 2 = "id"
		const offset = gqlPositionToOffset(content, { line: 1, character: 2 });
		expect(content[offset]).toBe("i");
	});

	test("handles position at start of line", () => {
		const content = "line0\nline1\nline2";
		const offset = gqlPositionToOffset(content, { line: 2, character: 0 });
		expect(offset).toBe("line0\nline1\n".length);
	});
});
